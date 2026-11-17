import { LLMProvider, CompletionRequest } from "../src/services/ai/provider";

/** Deterministic stand-in for an LLM, keyed off the prompt. Used ONLY in tests. */
export class FakeProvider implements LLMProvider {
  name = "fake";
  calls: CompletionRequest[] = [];
  configured = true;
  isConfigured() { return this.configured; }
  async complete(req: CompletionRequest) {
    this.calls.push(req);
    const s = req.system;
    if (s.includes("resume parser")) return JSON.stringify({
      parsed: { name: "Aarav Sharma", email: "aarav.sharma@example.com", phone: "+91 98765 43210", location: "Pune", summary: "Final-year BCA student.",
        education: [{ degree: "BCA", institution: "SPPU", year: "2026", grade: "8.1" }],
        technicalSkills: ["JavaScript", "React", "Node.js", "PostgreSQL", "HTML", "CSS", "Git"], softSkills: ["Teamwork"],
        experience: [{ role: "Web Development Intern", company: "Cascade Startups Hub", duration: "3 months", description: "REST APIs" }],
        projects: [{ name: "Expense Tracker", description: "MERN app", technologies: ["React", "Node.js"] }], certifications: [] },
      analysis: { atsScore: 72, strengths: ["Clear skills section"], weaknesses: ["No metrics"], suggestions: ["Quantify impact"], missingSections: ["Links"] } });
    if (s.includes("career coach")) return JSON.stringify({ summary: "Good fit.", strengths: ["React"], gaps: ["TypeScript"], advice: "Learn TypeScript." });
    if (s.includes("learning-path")) return "```json\n" + JSON.stringify({ title: "Path to Full Stack", items: [
      { skill: "TypeScript", title: "Learn TypeScript", description: "Types and generics", estimatedWeeks: 3, resources: [{ title: "TypeScript Handbook", type: "documentation" }] },
      { skill: "Docker", title: "Containerise an app", description: "Dockerfiles", estimatedWeeks: 2, resources: [] }] }) + "\n```";
    if (s.includes("professional resume writer")) return JSON.stringify({ rewrittenSummary: "Better summary", improvedBullets: [{ original: "Built REST APIs", improved: "Built REST APIs serving [X] requests/day", reason: "Adds impact" }], missingKeywords: ["CI/CD"], sectionAdvice: [{ section: "Projects", advice: "Add links" }], overallNotes: "Good start" });
    if (s.includes("experienced interviewer")) return JSON.stringify({ questions: [
      { category: "technical", question: "Explain the event loop." }, { category: "behavioral", question: "Tell me about a conflict." }, { category: "situational", question: "A deploy fails. What next?" }] });
    if (s.includes("interview coach summarising")) return JSON.stringify({ overallScore: 74, summary: "Solid.", strengths: ["Clarity"], weaknesses: ["Depth"], nextSteps: ["Practice"] });
    if (s.includes("interview coach")) return JSON.stringify({ score: 7.4, strengths: ["Clear"], improvements: ["More depth"], sampleAnswer: "A strong answer." });
    if (s.includes("career guidance assistant")) return "Focus on projects and TypeScript.";
    return "{}";
  }
}
