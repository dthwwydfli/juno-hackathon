import { lookupQueryVariants, primaryLookupName } from './drug-names';
import { apiFetch } from './api';

const SUPP_AI_BASE = 'https://supp.ai/api';

const LOW_VALUE = /\b(emulsion|intravenous|iv\b|parenteral|lipid emulsion|\/glycerol\/|based emulsion|infusion|neonat)\b/i;

function norm(s: string) {
  return s.trim().toLowerCase();
}

function agentMatchesQuery(agent: Record<string, unknown>, query: string): boolean {
  const q = norm(query);
  if (!q) return false;
  const preferred = norm(String(agent.preferred_name || ''));
  if (q.includes(preferred) || preferred.includes(q)) return true;
  const qTokens = q.split(/\s+/).filter((t) => t.length >= 3);
  if (!qTokens.length) return false;
  let hay = preferred;
  for (const syn of (agent.synonyms as string[]) || []) hay += ' ' + norm(String(syn));
  for (const trade of (agent.tradenames as string[]) || []) hay += ' ' + norm(String(trade));
  if (qTokens.some((t) => hay.includes(t))) return true;
  return Boolean(agent.matches);
}

function scoreAgent(agent: Record<string, unknown>, query: string): number {
  const q = norm(query);
  const preferred = norm(String(agent.preferred_name || ''));
  let score = 0;
  if (q === preferred) score += 50;
  else if (q.includes(preferred) || preferred.includes(q)) score += 30;
  for (const t of q.split(/\s+/)) {
    if (t.length >= 3 && preferred.includes(t)) score += 10;
  }
  if (LOW_VALUE.test(preferred)) score -= 40;
  const ent = String(agent.ent_type || '');
  if (ent === 'supplement' || ent === 'drug') score += 5;
  const count = agent.interacts_with_count;
  if (count) score += Math.min(Number(count) / 20, 5);
  return score;
}

async function searchAgentsDirect(query: string): Promise<Record<string, unknown>[]> {
  if (query.length < 2) return [];
  try {
    const res = await fetch(`${SUPP_AI_BASE}/agent/search?q=${encodeURIComponent(query)}&p=0`);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Record<string, unknown>[] };
    return data.results || [];
  } catch {
    return [];
  }
}

async function searchAgentDirect(displayName: string): Promise<Record<string, unknown> | null> {
  let best: Record<string, unknown> | null = null;
  let bestScore = -Infinity;
  for (const query of lookupQueryVariants(displayName)) {
    for (const agent of await searchAgentsDirect(query)) {
      if (!agentMatchesQuery(agent, query)) continue;
      const score = scoreAgent(agent, query);
      if (score > bestScore) {
        bestScore = score;
        best = agent;
      }
    }
    if (best && bestScore >= 25) break;
  }
  return best;
}

async function fetchInteractionEvidenceDirect(cuiA: string, cuiB: string): Promise<Record<string, unknown> | null> {
  if (!cuiA || !cuiB || cuiA === cuiB) return null;
  for (const iid of [`${cuiA}-${cuiB}`, `${cuiB}-${cuiA}`]) {
    try {
      const res = await fetch(`${SUPP_AI_BASE}/interaction/${iid}`);
      if (res.status === 404) continue;
      if (!res.ok) return null;
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export interface SuppAiEvidence {
  sentence: string;
  paper_title?: string;
  paper_year?: number;
}

function pickEvidenceSentences(interaction: Record<string, unknown>, limit = 2): SuppAiEvidence[] {
  const picked: SuppAiEvidence[] = [];
  for (const ev of (interaction.evidence as Record<string, unknown>[]) || []) {
    const paper = (ev.paper as Record<string, unknown>) || {};
    if (paper.retraction) continue;
    if (paper.animal_study && !paper.human_study) continue;
    for (const sent of (ev.sentences as Record<string, unknown>[]) || []) {
      const spans = (sent.spans as Record<string, unknown>[]) || [];
      const text = spans
        .map((s) => String(s.text || '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
      if (!text) continue;
      picked.push({
        sentence: text,
        paper_title: paper.title as string | undefined,
        paper_year: paper.year as number | undefined,
      });
      if (picked.length >= limit) return picked;
    }
  }
  return picked;
}

async function checkPairSuppaiViaBackend(
  nameA: string,
  nameB: string,
): Promise<{ evidence: SuppAiEvidence[]; lead: string } | null> {
  try {
    const res = await apiFetch<{ found: boolean; lead?: string; evidence?: SuppAiEvidence[] }>(
      `/proxy/suppai/pair?a=${encodeURIComponent(nameA)}&b=${encodeURIComponent(nameB)}`,
      { timeoutMs: 25_000 },
    );
    if (!res.found || !res.lead) return null;
    return { evidence: res.evidence || [], lead: res.lead };
  } catch {
    return null;
  }
}

async function checkPairSuppaiDirect(
  nameA: string,
  nameB: string,
): Promise<{ evidence: SuppAiEvidence[]; lead: string } | null> {
  const agentA = await searchAgentDirect(primaryLookupName(nameA));
  const agentB = await searchAgentDirect(primaryLookupName(nameB));
  if (!agentA || !agentB) return null;
  const cuiA = String(agentA.cui || '');
  const cuiB = String(agentB.cui || '');
  if (!cuiA || !cuiB) return null;
  const interaction = await fetchInteractionEvidenceDirect(cuiA, cuiB);
  if (!interaction) return null;
  const evidence = pickEvidenceSentences(interaction);
  const lead = evidence[0]?.sentence || '';
  if (!lead && !evidence.length) {
    return {
      evidence: [],
      lead: `Supp.AI lists a possible interaction between ${nameA} and ${nameB}.`,
    };
  }
  return { evidence, lead: lead || evidence[0].sentence };
}

export async function checkPairSuppai(
  nameA: string,
  nameB: string,
): Promise<{ evidence: SuppAiEvidence[]; lead: string } | null> {
  const viaBackend = await checkPairSuppaiViaBackend(nameA, nameB);
  if (viaBackend) return viaBackend;
  return checkPairSuppaiDirect(nameA, nameB);
}
