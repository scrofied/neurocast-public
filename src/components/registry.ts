import type { CompDef } from "./types";
import { LOOKUP } from "./lookup";
import { NeuralNet } from "./metaphor/NeuralNet";
import { AgentSwarm } from "./metaphor/AgentSwarm";
import { PromptChip } from "./metaphor/PromptChip";
import { DataFunnel } from "./metaphor/DataFunnel";
import { KnowledgeVault } from "./metaphor/KnowledgeVault";
import { AssemblyLine } from "./metaphor/AssemblyLine";
import { FeedGauge } from "./metaphor/FeedGauge";
import { SenseRig } from "./metaphor/SenseRig";
import { ReachGap } from "./metaphor/ReachGap";
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
import { RepoId } from "./screen/RepoId";
import { UiReplica } from "./screen/UiReplica";
import { LogoWall } from "./screen/LogoWall";
import { BrandQuoteCard } from "./screen/BrandQuoteCard";
import { CitationStrip } from "./screen/CitationStrip";
import { ScreenVersus } from "./screen/ScreenVersus";
import { EvidenceZoom } from "./screen/EvidenceZoom";
import { ScreenMarkup } from "./screen/ScreenMarkup";
import { RealDocScroll } from "./screen/RealDocScroll";
import { ScreenMorph } from "./screen/ScreenMorph";
import { CursorTrace } from "./screen/CursorTrace";
import { DemoReel } from "./screen/DemoReel";
import { AssetFull } from "./screen/AssetFull";
import { FootageStage } from "./screen/FootageStage";
import { PhoneFeed } from "./story/PhoneFeed";
import { SwordForge } from "./story/SwordForge";
import { Dialogue } from "./story/Dialogue";
import { Sink } from "./story/Sink";
import { CommentWall } from "./story/CommentWall";
import { SignalMap } from "./story/SignalMap";
import { Reframe } from "./story/Reframe";
import { SideBrandFx } from "./story/SideBrandFx";
import { SideCaps } from "./story/SideCaps";
import { SideEditorial } from "./story/SideEditorial";
import { SideScenes } from "./story/SideScenes";
import { PersonaScene } from "./story/PersonaScene";
import { PhotoWall } from "./story/PhotoWall";
import { StockBroll } from "./story/StockBroll";
import { BlameStrike } from "./info/BlameStrike";
import { PileCrush } from "./metaphor/PileCrush";
import { PitTrap } from "./metaphor/PitTrap";
import { UnreadFlood } from "./product/UnreadFlood";
import { OpenLedger } from "./info/OpenLedger";
import { RevealCards } from "./metaphor/RevealCards";
import { LeverLift } from "./metaphor/LeverLift";
import { RaceLanes } from "./metaphor/RaceLanes";
import { ThresholdDrop } from "./metaphor/ThresholdDrop";
import { QueueWindow } from "./metaphor/QueueWindow";
import { SilentDrift } from "./metaphor/SilentDrift";
import { SafetyBrake } from "./metaphor/SafetyBrake";
import { ShutterClose } from "./metaphor/ShutterClose";
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
import { AbacusMetaphor } from "./metaphor/AbacusMetaphor";
import { SideGraphic } from "./side/SideGraphic";
import { ScaleDive } from "./metaphor/ScaleDive";
import { Painkiller } from "./metaphor/Painkiller";
import { TimeCeiling } from "./metaphor/TimeCeiling";
import { CarryOrDig } from "./metaphor/CarryOrDig";
import { PyramidBase } from "./metaphor/PyramidBase";
import { GateWeld } from "./metaphor/GateWeld";
import { CommitRewind } from "./metaphor/CommitRewind";
import { VisibilitySeal } from "./metaphor/VisibilitySeal";
import { ForkPaths } from "./metaphor/ForkPaths";
import { AgentRelay } from "./metaphor/AgentRelay";
import { RelayParallel } from "./metaphor/RelayParallel";
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
// ── 移植自 opus-5-5-motion-gallery（2026-10 批次，机制逐条见 docs/OPUS55_ANIMATIONS.md）
import { KanbanSort } from "./metaphor/KanbanSort";
import { FormMorph } from "./product/FormMorph";
import { TextStructure } from "./metaphor/TextStructure";
import { FormulaDrive } from "./info/FormulaDrive";
import { BeatWall } from "./structure/BeatWall";
import { WaveCancel } from "./metaphor/WaveCancel";
import { GearTrain } from "./metaphor/GearTrain";
import { AttnWeights } from "./info/AttnWeights";
import { Quote } from "./structure/Quote";
import { PunchText } from "./structure/PunchText";
import { TierStack } from "./structure/TierStack";
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
  TierStack,
  Outro,
  TalkingHeadStage,
  HeadPip,
  TypoArch,
  InfiniteZoom,
  BeatWall,
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
  FormulaDrive,
  AttnWeights,
  // metaphor
  NeuralNet,
  AgentSwarm,
  PromptChip,
  DataFunnel,
  KnowledgeVault,
  AssemblyLine,
  FeedGauge,
  SenseRig,
  ReachGap,
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
  ShutterClose,
  TeardownLens,
  WalledGarden,
  AbacusMetaphor,
  SideGraphic,
  ScaleDive,
  Painkiller,
  TimeCeiling,
  CarryOrDig,
  PyramidBase,
  GateWeld,
  CommitRewind,
  VisibilitySeal,
  ForkPaths,
  AgentRelay,
  RelayParallel,
  RingAssembly,
  SpinnerReasoning,
  DustyShelf,
  MirrorReveal,
  SurfaceCore,
  OneFishFourPlates,
  KanbanSort,
  TextStructure,
  WaveCancel,
  GearTrain,
  ThresholdDrop,
  QueueWindow,
  SilentDrift,
  // story
  PhoneFeed,
  SwordForge,
  Dialogue,
  Sink,
  CommentWall,
  SignalMap,
  Reframe,
  SideBrandFx,
  SideCaps,
  SideEditorial,
  SideScenes,
  PersonaScene,
  PhotoWall,
  StockBroll,
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
  FormMorph,
  // screen
  ScreenDemo,
  BoardProof,
  RepoId,
  UiReplica,
  LogoWall,
  BrandQuoteCard,
  CitationStrip,
  ScreenVersus,
  EvidenceZoom,
  ScreenMarkup,
  RealDocScroll,
  ScreenMorph,
  CursorTrace,
  DemoReel,
  AssetFull,
  FootageStage,
  // per-script openings
  ...OPENINGS,
];

export const BY_ID: Record<string, CompDef> = Object.fromEntries(REGISTRY.map((c) => [c.id, c]));
for (const c of REGISTRY) LOOKUP[c.id] = c;
