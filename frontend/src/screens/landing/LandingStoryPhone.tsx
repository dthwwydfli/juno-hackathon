import type { StoryChapter } from './storyChapters';
import './landing.css';

type Props = {
  chapters: StoryChapter[];
  activeIndex: number;
  extraLabel?: string;
  onSelectChapter?: (index: number) => void;
  /** Shown on mobile inline under chapters */
  variant?: 'sticky' | 'inline';
};

export function LandingStoryPhone({
  chapters,
  activeIndex,
  extraLabel,
  onSelectChapter,
  variant = 'sticky',
}: Props) {
  const label = extraLabel ?? chapters[activeIndex]?.imageLabel ?? '';

  return (
    <div className={`landing-device-wrap landing-device-${variant}`}>
      <div className="landing-phone" role="img" aria-label={label}>
        <div className="landing-phone-screen">
          {chapters.map((slide, i) => (
            <img
              key={slide.image + slide.id}
              src={slide.image}
              alt=""
              className={i === activeIndex ? 'is-active' : undefined}
              width={390}
              height={844}
              decoding="async"
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
      </div>

      {onSelectChapter && (
        <div className="landing-slide-dots" role="tablist" aria-label="Story chapters">
          {chapters.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={slide.title}
              className={i === activeIndex ? 'is-active' : undefined}
              onClick={() => onSelectChapter(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
