import React from "react";
import { Composition, Folder } from "remotion";
import { REGISTRY } from "./components/registry";
import { Video } from "./engine/Video";
import type { Timeline } from "./types";
import sample from "./sample-timeline.json";

const FPS = 30;

// single-shot preview timeline for every asset in the library (Studio > Gallery)
const galleryTimeline = (id: string, example: any, sec: number, variant: number, skin: string): Timeline => {
  const dur = Math.round(sec * FPS);
  return {
    meta: { title: id, seed: 7, skin, font: "yahei", world: "grid", fps: FPS, width: 1920, height: 1080, mirror: false, showCaptions: false },
    durationInFrames: dur,
    chapters: [{ title: id, start: 0, end: dur }],
    shots: [{ id: "g", type: id, variant, start: 0, dur, chapter: 0, text: "", data: example, transition: "fly" }],
    captions: [],
  };
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="NeuroCast"
      component={Video as any}
      defaultProps={{ timeline: sample as unknown as Timeline }}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={300}
      calculateMetadata={({ props }: any) => {
        const tl = props.timeline as Timeline;
        return { durationInFrames: tl.durationInFrames, fps: tl.meta.fps, width: tl.meta.width, height: tl.meta.height };
      }}
    />
    <Folder name="Gallery">
      {REGISTRY.filter((c) => !c.noGallery).flatMap((c) =>
        new Array(Math.max(1, c.variants)).fill(0).map((_, v) => {
          const sec = Math.min(c.maxSec, Math.max(c.minSec, 6));
          return (
            <Composition
              key={`${c.id}-${v}`}
              id={`g-${c.id}-v${v}`}
              component={Video as any}
              defaultProps={{ timeline: galleryTimeline(c.id, c.example, sec, v, "aurora") }}
              fps={FPS}
              width={1920}
              height={1080}
              durationInFrames={Math.round(sec * FPS) + 12}
            />
          );
        })
      )}
    </Folder>
  </>
);
