import { describe, expect, it } from "vitest";
import fixtures from "@/lib/webapp/fixtures/camera-fixtures.json";
import type { CustomMove } from "@/lib/webapp/camera/cameraCustom";
import type { Training } from "@/lib/webapp/camera/cameraTraining";
import {
  creatorPageUrl,
  creatorRedirect,
  parseHandle,
  parseTrainingCode,
  readShareLocation,
  trainingAppUrl,
  trainingRedirect,
  trainingShareUrl,
  trainingWebRunUrl,
} from "./link";
import { readBoard, readCard, readCreatorPage, readDiscover, readProfile, readRun, readShared, setRows, trainingFacts } from "./data";
import { builderMoves, checkDraft, draftBody, draftOf, emptyDraft, moveNameProblem, moveSet, newMoveBody, newSet } from "./builder";
import { query } from "./api";

const move = fixtures.custom.move as unknown as CustomMove;
const training = fixtures.custom.training.expect.training as unknown as Training;

describe("training links", () => {
  it("reads share codes from hashes and paths, case-insensitively, only from the invite alphabet", () => {
    expect(parseTrainingCode("#abcd2345")).toBe("ABCD2345");
    expect(parseTrainingCode("/t/ABCD2345/")).toBe("ABCD2345");
    expect(parseTrainingCode("/fr/t/abcd2345")).toBe("ABCD2345");
    expect(parseTrainingCode("ABCD2345?c=WXYZ2345")).toBe("ABCD2345");
    expect(parseTrainingCode("ABCD0345")).toBeNull(); // 0 is not in the alphabet
    expect(parseTrainingCode("ABCD234")).toBeNull();
    expect(parseTrainingCode(null)).toBeNull();
  });

  it("finds the challenge in the query (after the 404 forward) or after the code in the hash", () => {
    expect(readShareLocation("#ABCD2345", "?c=wxyz2345")).toEqual({ code: "ABCD2345", challenge: "WXYZ2345" });
    expect(readShareLocation("#ABCD2345?c=WXYZ2345", "")).toEqual({ code: "ABCD2345", challenge: "WXYZ2345" });
    expect(readShareLocation("#ABCD2345", "")).toEqual({ code: "ABCD2345", challenge: null });
    expect(readShareLocation("", "?c=bad")).toEqual({ code: null, challenge: null });
  });

  it("the 404 page forwards /<lang>/t/<CODE> and /t/<CODE> to the hash page, the challenge kept", () => {
    expect(trainingRedirect("/fr/t/abcd2345", "en")).toBe("/fr/t/#ABCD2345");
    expect(trainingRedirect("/en/t/ABCD2345/", "fr")).toBe("/en/t/#ABCD2345");
    expect(trainingRedirect("/t/ABCD2345", "fr")).toBe("/fr/t/#ABCD2345");
    expect(trainingRedirect("/en/t/ABCD2345", "en", "?c=wxyz2345")).toBe("/en/t/?c=WXYZ2345#ABCD2345");
    expect(trainingRedirect("/en/t/", "en")).toBeNull();
    expect(trainingRedirect("/en/c/ABCD2345", "en")).toBeNull();
    expect(trainingRedirect("/de/t/ABCD2345", "en")).toBeNull();
  });

  it("the redirect works serialised into the 404 page's inline script (no module references)", () => {
    const fn = new Function(`var trainingRedirect=${trainingRedirect.toString()};var creatorRedirect=${creatorRedirect.toString()};
      return [trainingRedirect("/en/t/ABCD2345","fr","?c=WXYZ2345"), creatorRedirect("/fr/coach/Sam_Fit","en")];`);
    expect(fn()).toEqual(["/en/t/?c=WXYZ2345#ABCD2345", "/fr/coach/#sam_fit"]);
  });

  it("creator pages: handles and the /coach/<handle> forward", () => {
    expect(parseHandle("#Sam_Fit")).toBe("sam_fit");
    expect(parseHandle("@sam")).toBe("sam");
    expect(parseHandle("ab")).toBeNull();
    expect(parseHandle("a-b-c")).toBeNull();
    expect(creatorRedirect("/coach/sam_fit/", "en")).toBe("/en/coach/#sam_fit");
    expect(creatorRedirect("/en/coach/", "en")).toBeNull();
    expect(creatorPageUrl("fr", "sam")).toBe("/fr/coach/#sam");
  });

  it("builds the share, app and web-run links", () => {
    expect(trainingShareUrl("https://vvake.com/", "en", "ABCD2345")).toBe("https://vvake.com/en/t/ABCD2345");
    expect(trainingShareUrl("https://vvake.com", "fr", "ABCD2345", "WXYZ2345")).toBe("https://vvake.com/fr/t/ABCD2345?c=WXYZ2345");
    expect(trainingAppUrl("vvake", "ABCD2345")).toBe("vvake://t/ABCD2345");
    expect(trainingWebRunUrl("en", "ABCD2345", "WXYZ2345")).toBe("/en/app/#/train/ABCD2345/WXYZ2345");
  });
});

describe("reading the API", () => {
  const shared = {
    training: { ...training, code: "abcd2345" },
    creator: { name: "Sam", handle: "Sam_Fit" },
    stats: { athletes: 12, runs: 30, totalReps: 4567, heartPoints: 890, coachScore: 321 },
  };

  it("a shared training goes through cleanTraining and keeps only public fields", () => {
    const s = readShared(shared)!;
    expect(s.training.name).toBe("Parity burner");
    expect(s.training.moves.map((m) => m.id)).toEqual(["m_parity0001"]);
    expect(s.code).toBe("ABCD2345");
    expect(s.creator).toEqual({ id: null, name: "Sam", handle: "sam_fit" });
    expect(s.stats).toEqual({ athletes: 12, runs: 30, totalReps: 4567, heartPoints: 890, coachScore: 321 });
  });

  it("a training the apps would refuse is not shown; missing numbers read as 0", () => {
    expect(readShared({ ...shared, training: { ...training, sets: [] } })).toBeNull();
    expect(readShared({ ...shared, training: { ...training, name: "buy tokens now" } })).toBeNull();
    expect(readShared(null)).toBeNull();
    const s = readShared({ training, creator: null }, "abcd2345")!;
    expect(s.stats.athletes).toBe(0);
    expect(s.creator.name).toBe("VVake");
    expect(s.code).toBe("ABCD2345");
  });

  it("the set rows: names (taught moves from the training), targets, zones or effort, rests", () => {
    const en = setRows(training, "en");
    expect(en.map((r) => r.name)).toEqual(["Squat", "Punch", "Plank"]);
    expect(en[0]).toMatchObject({ target: "12 reps", zone: 3, restS: 30, custom: false });
    expect(en[0]!.intensity).toMatch(/^Zone 3/);
    expect(en[1]).toMatchObject({ custom: true, target: "10 reps", zone: 4 });
    expect(en[2]).toMatchObject({ target: "30 s", intensity: "Effort 6/10", zone: null });
    expect(setRows(training, "fr")[0]!.target).toBe("12 répétitions");
    expect(trainingFacts(training)).toEqual({ minutes: fixtures.custom.training.expect.minutes, sets: 6, rounds: 2, customMoves: 1 });
  });

  it("cards, Discover and creator pages: lenient, ids and handles checked", () => {
    const card = readCard({
      id: "t_abcdefghij",
      code: "abcd2345",
      name: "Legs",
      level: "nope",
      minutes: 20,
      creator: { name: "Sam", handle: "sam" },
      stats: { athletes: 4 },
    });
    expect(card).toMatchObject({ code: "ABCD2345", level: "intermediate", minutes: 20, athletes: 4, creator: { handle: "sam" } });
    expect(readCard({ name: "no id" })).toBeNull();
    const d = readDiscover({
      trainings: [card, { bad: 1 }],
      creators: [{ name: "Sam", handle: "sam", followers: 3 }, { handle: "x" }],
      next: "abc",
    });
    expect(d.trainings).toHaveLength(1);
    expect(d.creators.map((c) => c.handle)).toEqual(["sam"]);
    expect(d.next).toBe("abc");
    expect(readDiscover(null)).toEqual({ trainings: [], creators: [], next: null });
    const p = readCreatorPage({
      creator: { name: "Sam", handle: "Sam", bio: "Hi", followers: 2, joins: 5, coachScore: 120 },
      trainings: [card],
    });
    expect(p?.creator).toMatchObject({ handle: "sam", followers: 2, joins: 5, coachScore: 120, city: null });
    expect(readCreatorPage({ creator: { handle: "!" } })).toBeNull();
  });

  it("challenge boards are sorted and capped; runs and profiles read safely", () => {
    const b = readBoard({
      training: { code: "abcd2345", name: "Legs" },
      endsAt: "2026-10-22T10:00:00Z",
      members: 3,
      leaderboard: [
        { name: null, score: 500 },
        { name: "Ana", score: 1200 },
      ],
    })!;
    expect(b.leaderboard).toEqual([
      { name: "Ana", score: 1000 },
      { name: null, score: 500 },
    ]);
    expect(b.training.code).toBe("ABCD2345");
    expect(readRun({ run: { score: 640, completion: 0.9, inZone: null, completed: true, qualifying: false } })).toEqual({
      score: 640,
      completion: 0.9,
      inZone: null,
      completed: true,
      qualifying: false,
    });
    expect(readRun({})).toBeNull();
    expect(readProfile({ handle: "Sam", public: true, bio: "x", showCity: 1 })).toEqual({
      handle: "sam",
      public: true,
      bio: "x",
      showCity: false,
    });
  });

  it("query strings leave empty values out", () => {
    expect(query({ q: "leg day", level: "", sort: "new", cursor: undefined })).toBe("?q=leg%20day&sort=new");
    expect(query({})).toBe("");
  });
});

describe("the builder checks what the API checks (game-core cleanTraining)", () => {
  it("a new draft is valid once named; the body carries only the custom moves used", () => {
    const d = emptyDraft();
    expect(checkDraft(d, [move], "en")).toEqual({ problem: "name" });
    const named = { ...d, name: "Leg day" };
    const ok = checkDraft(named, [move], "en");
    expect("training" in ok && ok.training.sets).toEqual([{ move: "squat", reps: 12, zone: 3, restS: 45 }]);
    expect(draftBody(named, [move], "en").moves).toEqual([]);
    const withMine = { ...named, sets: [...named.sets, newSet(move.id, [move])] };
    expect(draftBody(withMine, [move], "en").moves.map((m) => m.id)).toEqual([move.id]);
  });

  it("holds take seconds, zones or effort, rounds; problems come back by name", () => {
    const d = { ...emptyDraft(), name: "Core", sets: [newSet("plank", [])], rounds: 3, roundRestS: 90 };
    expect(d.sets[0]!.amount).toBe(30);
    const ok = checkDraft(d, [], "fr");
    expect("training" in ok && ok.training).toMatchObject({ rounds: 3, roundRestS: 90, lang: "fr", sets: [{ move: "plank", holdS: 30 }] });
    expect(checkDraft({ ...d, rounds: 11 }, [], "en")).toEqual({ problem: "rounds" });
    expect(checkDraft({ ...d, sets: [] }, [], "en")).toEqual({ problem: "no_sets" });
    expect(checkDraft({ ...d, sets: [{ ...d.sets[0]!, amount: 2 }] }, [], "en")).toEqual({ problem: "target" });
    expect(checkDraft({ ...d, name: "see www.example.com" }, [], "en")).toEqual({ problem: "name" });
    expect(checkDraft({ ...d, sets: [{ ...newSet(move.id, [move]) }] }, [], "en")).toEqual({ problem: "unknown_move" });
    const effort = checkDraft({ ...d, sets: [{ ...d.sets[0]!, intensity: "effort", rpe: 7 }] }, [], "en");
    expect("training" in effort && effort.training.sets[0]).toEqual({ move: "plank", holdS: 30, rpe: 7, restS: 45 });
  });

  it("edits round-trip: a training into the form and back is the same training", () => {
    const back = checkDraft(draftOf(training), training.moves, "en");
    expect("training" in back && back.training.sets).toEqual(training.sets.map((s) => ({ restS: 45, ...s })));
  });

  it("moving sets, the move list, teach-a-move names and bodies", () => {
    const a = newSet("squat", []);
    const b = newSet("plank", []);
    expect(moveSet([a, b], 0, 1)).toEqual([b, a]);
    expect(moveSet([a, b], 0, -1)).toEqual([a, b]);
    const list = builderMoves([move], "en");
    expect(list.catalogue.length).toBeGreaterThan(20);
    expect(list.mine).toEqual([{ id: move.id, name: "Punch" }]);
    expect(moveNameProblem("My punch")).toBeNull();
    expect(moveNameProblem("x".repeat(33))).toBe("long");
    expect(moveNameProblem("call 555 123 4567")).toBe("contact");
    expect(newMoveBody(move.template, "  Punch ", "nope", true, true)).toMatchObject({
      name: "Punch",
      icon: "figure.strengthtraining.functional",
      kind: "reps",
      weighted: true,
      checked: true,
    });
  });
});
