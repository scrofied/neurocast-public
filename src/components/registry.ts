import type { CompDef } from "./types";
import { LOOKUP } from "./lookup";
import { NeuralNet } from "./metaphor/NeuralNet";
import { AgentSwarm } from "./metaphor/AgentSwarm";
import { PromptChip } from "./metaphor/PromptChip";
import { DataFunnel } from "./metaphor/DataFunnel";
import { KnowledgeVault } from "./metaphor/KnowledgeVault";
import { AssemblyLine } from "./metaphor/AssemblyLine";
import { Flywheel } from "./metaphor/Flywheel";
import { DominoChain } from "./metaphor/DominoChain";
import { AssetDistill } from "./metaphor/AssetDistill";
import { UntappedPotential } from "./metaphor/UntappedPotential";
import { ScopeShrink } from "./metaphor/ScopeShrink";
import { LaborTakeover } from "./metaphor/LaborTakeover";
import { ParticleNumber } from "./info/ParticleNumber";
import { CodeEditor } from "./info/CodeEditor";
import { EnergyPipeline } from "./info/EnergyPipeline";
import { Timeline } from "./info/Timeline";
import { VersusClash } from "./info/VersusClash";
import { GrowthCurve } from "./info/GrowthCurve";
import { CardStack } from "./info/CardStack";
import { BulletCards } from "./info/BulletCards";
import { LogicFlip } from "./info/LogicFlip";
import { ScaleGap } from "./info/ScaleGap";
import { BeforeAfter } from "./info/BeforeAfter";
import { Leaderboard } from "./info/Leaderboard";
import { DayClock } from "./info/DayClock";
import { ScreenDemo } from "./screen/ScreenDemo";
import { BoardProof } from "./screen/BoardProof";
import { UiReplica } from "./screen/UiReplica";
import { LogoWall } from "./screen/LogoWall";
import { BrandQuoteCard } from "./screen/BrandQuoteCard";
import { CitationStrip } from "./screen/CitationStrip";
import { ScreenVersus } from "./screen/ScreenVersus";
import { EvidenceZoom } from "./screen/EvidenceZoom";
import { RealDocScroll } from "./screen/RealDocScroll";
import { ScreenMorph } from "./screen/ScreenMorph";
import { CursorTrace } from "./screen/CursorTrace";
import { PhoneFeed } from "./story/PhoneFeed";
import { SwordForge } from "./story/SwordForge";
import { Dialogue } from "./story/Dialogue";
import { Sink } from "./story/Sink";
import { CommentWall } from "./story/CommentWall";
import { SignalMap } from "./story/SignalMap";
import { Reframe } from "./story/Reframe";
import { PersonaScene } from "./story/PersonaScene";
import { PhotoWall } from "./story/PhotoWall";
import { BlameStrike } from "./info/BlameStrike";
import { PileCrush } from "./metaphor/PileCrush";
import { PitTrap } from "./metaphor/PitTrap";
import { UnreadFlood } from "./product/UnreadFlood";
import { OpenLedger } from "./info/OpenLedger";
import { RevealCards } from "./metaphor/RevealCards";
import { LeverLift } from "./metaphor/LeverLift";
import { RaceLanes } from "./metaphor/RaceLanes";
import { SafetyBrake } from "./metaphor/SafetyBrake";
import { StepRail } from "./info/StepRail";
import { TierGrid } from "./info/TierGrid";
import { SpecMatrix } from "./info/SpecMatrix";
import { TeardownLens } from "./metaphor/TeardownLens";
import { VetCard } from "./info/VetCard";
import { TimeShards } from "./info/TimeShards";
import { MeasureRuler } from "./info/MeasureRuler";
import { CounterExample } from "./info/CounterExample";
import { VersionLanes } from "./info/VersionLanes";
import { FillBuild } from "./info/FillBuild";
import { InplaceEvolve } from "./info/InplaceEvolve";
import { RewardBeat } from "./info/RewardBeat";
import { CaseReplay } from "./info/CaseReplay";
import { RingAssembly } from "./metaphor/RingAssembly";
import { SpinnerReasoning } from "./metaphor/SpinnerReasoning";
import { DustyShelf } from "./metaphor/DustyShelf";
import { MirrorReveal } from "./metaphor/MirrorReveal";
import { SurfaceCore } from "./metaphor/SurfaceCore";
import { OneFishFourPlates } from "./metaphor/OneFishFourPlates";
import { AbAudioWave } from "./info/AbAudioWave";
import { WalledGarden } from "./metaphor/WalledGarden";
import { ScaleDive } from "./metaphor/ScaleDive";
import { Painkiller } from "./metaphor/Painkiller";
import { TimeCeiling } from "./metaphor/TimeCeiling";
import { CarryOrDig } from "./metaphor/CarryOrDig";
import { ForkPaths } from "./metaphor/ForkPaths";
import { ToolCard } from "./product/ToolCard";
import { ChatCommand } from "./product/ChatCommand";
import { BrowserAgent } from "./product/BrowserAgent";
import { DataSieve } from "./product/DataSieve";
import { TopicRadar } from "./product/TopicRadar";
import { Checklist } from "./product/Checklist";
import { FileLaunch } from "./product/FileLaunch";
import { FolderSave } from "./product/FolderSave";
import { BugFixLoop } from "./product/BugFixLoop";
import { DragDeploy } from "./product/DragDeploy";
import { Quote } from "./structure/Quote";
import { PunchText } from "./structure/PunchText";
import { ChapterCard } from "./structure/ChapterCard";
import { Narration } from "./structure/Narration";
import { Hook } from "./structure/Hook";
import { Outro } from "./structure/Outro";
import { TalkingHeadStage } from "./structure/TalkingHeadStage";
import { HeadPip } from "./structure/HeadPip";
import { TypoArch } from "./structure/TypoArch";
import { InfiniteZoom } from "./structure/InfiniteZoom";
import { OPENINGS } from "../openings";

// The asset library. Every entry is one reusable animated component; add new ones here
// (see SKILL.md · 扩展组件资产) and they become available to storyboards, the auto planner and the Gallery.
export const REGISTRY: CompDef[] = [
  // structure
  Hook,
  ChapterCard,
  Narration,
  Quote,
  PunchText,
  Outro,
  TalkingHeadStage,
  HeadPip,
  TypoArch,
  InfiniteZoom,
  // info
  ParticleNumber,
  CodeEditor,
  EnergyPipeline,
  Timeline,
  VersusClash,
  GrowthCurve,
  CardStack,
  BulletCards,
  LogicFlip,
  ScaleGap,
  BeforeAfter,
  Leaderboard,
  DayClock,
  BlameStrike,
  OpenLedger,
  StepRail,
  TierGrid,
  SpecMatrix,
  VetCard,
  TimeShards,
  MeasureRuler,
  CounterExample,
  VersionLanes,
  AbAudioWave,
  CaseReplay,
  FillBuild,
  InplaceEvolve,
  RewardBeat,
  // metaphor
  NeuralNet,
  AgentSwarm,
  PromptChip,
  DataFunnel,
  KnowledgeVault,
  AssemblyLine,
  Flywheel,
  DominoChain,
  AssetDistill,
  UntappedPotential,
  ScopeShrink,
  LaborTakeover,
  PileCrush,
  PitTrap,
  RevealCards,
  LeverLift,
  RaceLanes,
  SafetyBrake,
  TeardownLens,
  WalledGarden,
  ScaleDive,
  Painkiller,
  TimeCeiling,
  CarryOrDig,
  ForkPaths,
  RingAssembly,
  SpinnerReasoning,
  DustyShelf,
  MirrorReveal,
  SurfaceCore,
  OneFishFourPlates,
  // story
  PhoneFeed,
  SwordForge,
  Dialogue,
  Sink,
  CommentWall,
  SignalMap,
  Reframe,
  PersonaScene,
  PhotoWall,
  // product
  ToolCard,
  ChatCommand,
  BrowserAgent,
  DataSieve,
  TopicRadar,
  Checklist,
  FileLaunch,
  FolderSave,
  BugFixLoop,
  DragDeploy,
  UnreadFlood,
  // screen
  ScreenDemo,
  BoardProof,
  UiReplica,
  LogoWall,
  BrandQuoteCard,
  CitationStrip,
  ScreenVersus,
  EvidenceZoom,
  RealDocScroll,
  ScreenMorph,
  CursorTrace,
  // per-script openings
  ...OPENINGS,
];

export const BY_ID: Record<string, CompDef> = Object.fromEntries(REGISTRY.map((c) => [c.id, c]));
for (const c of REGISTRY) LOOKUP[c.id] = c;
