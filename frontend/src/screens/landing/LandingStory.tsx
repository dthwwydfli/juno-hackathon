import { useCallback, useRef, type ReactNode } from 'react';
import { LandingIcon } from './LandingIcon';
import { LandingStoryPhone } from './LandingStoryPhone';
import { PRIVACY_CHAPTER, STORY_CHAPTERS } from './storyChapters';
import { useActiveChapter, useParallaxScroll } from './useLandingStory';
import './landing.css';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Props = {
  introActions: ReactNode;
};

export function LandingStory({ introActions }: Props) {
  const storyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useParallaxScroll(storyRef);

  const bindSection = useCallback((index: number) => (el: HTMLElement | null) => {
    sectionRefs.current[index] = el;
  }, []);

  const sectionCount = STORY_CHAPTERS.length + 1; /* story chapters + privacy */
  const activeIndex = useActiveChapter(sectionRefs, sectionCount);
  const phoneIndex = Math.min(activeIndex, STORY_CHAPTERS.length - 1);
  const onPrivacy = activeIndex >= STORY_CHAPTERS.length;

  const scrollToChapter = useCallback((index: number) => {
    const reduced = prefersReducedMotion();
    sectionRefs.current[index]?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'center',
    });
  }, []);

  return (
    <div className="landing-story" ref={storyRef}>
      <div className="landing-parallax-bg" aria-hidden="true">
        <span className="landing-blob landing-blob-a" />
        <span className="landing-blob landing-blob-b" />
      </div>

      <div className="landing-story-grid">
        <div className="landing-story-scroll">
          <section
            id="story"
            className="landing-chapter landing-chapter-intro"
            data-chapter-index={0}
            ref={bindSection(0)}
            aria-labelledby="landing-headline"
          >
            <h1 id="landing-headline">{STORY_CHAPTERS[0].title}</h1>
            <p>{STORY_CHAPTERS[0].body}</p>
            {introActions}
            <div className="landing-chapter-mobile-phone" aria-hidden="true">
              <LandingStoryPhone chapters={STORY_CHAPTERS} activeIndex={phoneIndex} variant="inline" />
            </div>
          </section>

          {STORY_CHAPTERS.slice(1).map((chapter, i) => {
            const index = i + 1;
            return (
              <section
                key={chapter.id}
                className={`landing-chapter${activeIndex === index ? ' is-active' : ''}`}
                data-chapter-index={index}
                ref={bindSection(index)}
                aria-labelledby={`chapter-${chapter.id}`}
              >
                <span className="landing-chapter-icon" aria-hidden="true">
                  <LandingIcon name={chapter.icon} size={28} strokeWidth={2} />
                </span>
                <h2 id={`chapter-${chapter.id}`} className="landing-chapter-title">
                  {chapter.title}
                </h2>
                <p className="landing-chapter-body">{chapter.body}</p>
                <div className="landing-chapter-mobile-phone" aria-hidden="true">
                  <LandingStoryPhone chapters={STORY_CHAPTERS} activeIndex={index} variant="inline" />
                </div>
              </section>
            );
          })}
        </div>

        {!onPrivacy && (
          <aside className="landing-story-sticky">
            <LandingStoryPhone
              chapters={STORY_CHAPTERS}
              activeIndex={phoneIndex}
              onSelectChapter={scrollToChapter}
              variant="sticky"
            />
          </aside>
        )}
      </div>

      <section
        id="privacy"
        className={`landing-privacy-band${onPrivacy ? ' is-active' : ''}`}
        data-chapter-index={STORY_CHAPTERS.length}
        ref={bindSection(STORY_CHAPTERS.length)}
        aria-labelledby="privacy-title"
      >
        <div className="landing-privacy-split">
          <div className="landing-privacy-lead">
            <h2 id="privacy-title" className="landing-chapter-title">
              {PRIVACY_CHAPTER.title}
            </h2>
            <p className="landing-chapter-disclaimer">{PRIVACY_CHAPTER.disclaimer}</p>
          </div>
          <ul className="landing-privacy-list">
            {PRIVACY_CHAPTER.items.map((item) => (
              <li key={item.title}>
                <span className="landing-privacy-icon" aria-hidden="true">
                  <LandingIcon name={item.icon} size={22} strokeWidth={2} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
