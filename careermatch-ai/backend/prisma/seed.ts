import "dotenv/config";
import { PrismaClient, JobType, WorkMode, ExperienceLevel } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type J = {
  t: string; c: string; l: string; m?: WorkMode; ty?: JobType; lv?: ExperienceLevel; cat: string;
  req: string[]; pref?: string[]; cgpa?: number; min?: number; max?: number; d: string;
};

// ALL LISTINGS BELOW ARE FICTIONAL DEMONSTRATION DATA. Company names are invented and do not
// refer to real hiring organisations. Salaries are annual INR, except internships (monthly stipend).
const jobs: J[] = [
  { t: "Frontend Developer", c: "Brightwave Labs", l: "Bengaluru, Karnataka", m: "HYBRID", cat: "Web Development", req: ["JavaScript", "React", "HTML", "CSS"], pref: ["TypeScript", "Tailwind CSS", "Git"], cgpa: 6.5, min: 500000, max: 900000, d: "Build responsive, accessible interfaces for our analytics product. You will translate designs into reusable React components, collaborate with backend engineers on API contracts and write unit tests for UI logic." },
  { t: "Frontend Developer Intern", c: "Pixelforge Studio", l: "Pune, Maharashtra", ty: "INTERNSHIP", m: "ONSITE", cat: "Web Development", req: ["HTML", "CSS", "JavaScript"], pref: ["React", "Git"], min: 15000, max: 25000, d: "A 6-month internship working alongside senior engineers on marketing sites and dashboards. You will ship real features, learn code review practices and get mentorship on modern React." },
  { t: "Full Stack Developer", c: "Nimbus Commerce", l: "Hyderabad, Telangana", m: "HYBRID", lv: "JUNIOR", cat: "Web Development", req: ["React", "Node.js", "PostgreSQL", "REST APIs"], pref: ["TypeScript", "Docker", "AWS"], cgpa: 6.0, min: 700000, max: 1300000, d: "Own features end to end across our React storefront and Node.js services. Design database schemas, write performant queries and participate in on-call rotation for the checkout stack." },
  { t: "Backend Developer (Node.js)", c: "Quanta Payments", l: "Mumbai, Maharashtra", m: "ONSITE", lv: "JUNIOR", cat: "Backend Development", req: ["Node.js", "Express.js", "PostgreSQL", "REST APIs"], pref: ["Redis", "Docker", "TypeScript"], min: 800000, max: 1400000, d: "Develop secure, high-throughput payment APIs. Emphasis on validation, idempotency, observability and automated testing. You will work with a small, senior backend team." },
  { t: "Software Engineer Trainee", c: "Meridian Systems", l: "Chennai, Tamil Nadu", m: "ONSITE", cat: "Software Engineering", req: ["Data Structures", "Java", "SQL"], pref: ["Spring Boot", "Git"], cgpa: 7.0, min: 400000, max: 600000, d: "Structured 6-month training program followed by placement on enterprise product teams. Strong fundamentals in data structures, OOP and databases expected." },
  { t: "Python Developer", c: "Lattice Analytics", l: "Remote (India)", m: "REMOTE", lv: "JUNIOR", cat: "Backend Development", req: ["Python", "SQL", "REST APIs"], pref: ["Django", "PostgreSQL", "Docker"], min: 600000, max: 1100000, d: "Build data ingestion services and internal APIs in Python. You will write clean, tested code, review pull requests and help improve our CI pipeline." },
  { t: "Data Analyst", c: "Orbit Retail Insights", l: "Gurugram, Haryana", m: "HYBRID", cat: "Data & Analytics", req: ["SQL", "Excel", "Python"], pref: ["Power BI", "Tableau", "Statistics"], cgpa: 6.5, min: 450000, max: 800000, d: "Turn sales and customer data into decisions. Build dashboards, run ad-hoc analyses and present findings to category managers every week." },
  { t: "Data Analyst Intern", c: "Cobalt Health Data", l: "Bengaluru, Karnataka", ty: "INTERNSHIP", m: "HYBRID", cat: "Data & Analytics", req: ["SQL", "Excel"], pref: ["Python", "Power BI"], min: 12000, max: 20000, d: "Support the analytics team with data cleaning, exploratory analysis and weekly reporting for healthcare operations. Training provided on BI tools." },
  { t: "Machine Learning Engineer", c: "Vertex Minds", l: "Bengaluru, Karnataka", m: "HYBRID", lv: "JUNIOR", cat: "AI & Machine Learning", req: ["Python", "Machine Learning", "scikit-learn", "SQL"], pref: ["TensorFlow", "PyTorch", "Docker"], cgpa: 7.0, min: 1000000, max: 1800000, d: "Train, evaluate and deploy models for demand forecasting. Work with data engineers to productionise pipelines and monitor model drift." },
  { t: "AI/ML Intern", c: "Synapse Robotics", l: "Hyderabad, Telangana", ty: "INTERNSHIP", m: "ONSITE", cat: "AI & Machine Learning", req: ["Python", "Machine Learning"], pref: ["PyTorch", "NumPy", "Pandas"], cgpa: 7.0, min: 20000, max: 30000, d: "Assist researchers with dataset preparation, model experiments and evaluation for computer-vision features. Good opportunity for strong ML coursework graduates." },
  { t: "Data Scientist", c: "Helix Fintech", l: "Mumbai, Maharashtra", m: "HYBRID", lv: "MID", cat: "AI & Machine Learning", req: ["Python", "Machine Learning", "Statistics", "SQL"], pref: ["PyTorch", "Spark", "AWS"], min: 1500000, max: 2600000, d: "Lead credit-risk modelling projects from problem framing to deployment. Communicate results to non-technical stakeholders." },
  { t: "DevOps Engineer", c: "Stratus Cloudworks", l: "Pune, Maharashtra", m: "HYBRID", lv: "JUNIOR", cat: "Cloud & DevOps", req: ["Linux", "Docker", "CI/CD", "AWS"], pref: ["Kubernetes", "Terraform", "Python"], min: 900000, max: 1600000, d: "Automate build, test and deployment pipelines and keep our infrastructure reliable. Participate in incident response and capacity planning." },
  { t: "Cloud Support Associate", c: "Cumulus Hosting", l: "Noida, Uttar Pradesh", m: "ONSITE", cat: "Cloud & DevOps", req: ["Linux", "Networking", "AWS"], pref: ["Python", "Bash"], min: 350000, max: 550000, d: "Provide first- and second-line technical support for cloud customers, troubleshoot networking and compute issues and document solutions." },
  { t: "QA Engineer", c: "Veritas Software", l: "Bengaluru, Karnataka", m: "HYBRID", cat: "Quality Assurance", req: ["Manual Testing", "SQL", "Test Automation"], pref: ["Selenium", "Java", "Postman"], min: 450000, max: 800000, d: "Design test plans, automate regression suites and work with developers to catch defects early. Exposure to API testing is a plus." },
  { t: "UI/UX Designer", c: "Mosaic Interactive", l: "Remote (India)", m: "REMOTE", cat: "Design", req: ["Figma", "User Research", "Wireframing"], pref: ["Prototyping", "Design Systems"], min: 500000, max: 1000000, d: "Design intuitive flows for web and mobile products, run usability tests and maintain our design system together with front-end engineers." },
  { t: "UI/UX Design Intern", c: "Inkwell Digital", l: "Ahmedabad, Gujarat", ty: "INTERNSHIP", m: "ONSITE", cat: "Design", req: ["Figma", "Wireframing"], pref: ["User Research"], min: 8000, max: 15000, d: "Create wireframes and high-fidelity mockups under the guidance of a lead designer; participate in client workshops and usability testing sessions." },
  { t: "Mobile App Developer (Flutter)", c: "Kite Mobility", l: "Kochi, Kerala", m: "HYBRID", lv: "JUNIOR", cat: "Mobile Development", req: ["Dart", "Flutter", "REST APIs"], pref: ["Firebase", "Git"], min: 500000, max: 950000, d: "Build and maintain cross-platform apps used by thousands of daily riders. Focus on performance, offline support and clean architecture." },
  { t: "Android Developer", c: "Roamly Travel Tech", l: "Gurugram, Haryana", m: "HYBRID", lv: "JUNIOR", cat: "Mobile Development", req: ["Kotlin", "Android", "REST APIs"], pref: ["Jetpack Compose", "Room"], min: 600000, max: 1100000, d: "Develop features for our travel-booking Android app using modern Kotlin and Jetpack libraries. Write unit and UI tests." },
  { t: "Cybersecurity Analyst", c: "Aegis Secure", l: "Mumbai, Maharashtra", m: "ONSITE", lv: "JUNIOR", cat: "Security", req: ["Networking", "Linux", "Security Fundamentals"], pref: ["SIEM", "Python", "Penetration Testing"], min: 600000, max: 1100000, d: "Monitor security events, triage alerts and help harden client environments. Participate in vulnerability assessments and incident response drills." },
  { t: "Technical Support Engineer", c: "Pioneer SaaS", l: "Remote (India)", m: "REMOTE", cat: "Support", req: ["Troubleshooting", "SQL", "Communication"], pref: ["REST APIs", "Linux"], min: 350000, max: 600000, d: "Help customers debug integration issues, reproduce bugs and escalate to engineering with clear reports. Great path into software roles." },
  { t: "Business Analyst", c: "Crestline Consulting", l: "Gurugram, Haryana", m: "HYBRID", cat: "Business & Product", req: ["SQL", "Excel", "Communication"], pref: ["Power BI", "Agile", "Jira"], cgpa: 6.5, min: 500000, max: 900000, d: "Gather requirements, document processes and work with developers and stakeholders to deliver reporting and workflow improvements." },
  { t: "Associate Product Manager", c: "Lumen Learning", l: "Bengaluru, Karnataka", m: "HYBRID", cat: "Business & Product", req: ["Communication", "Data Analysis", "Agile"], pref: ["SQL", "Figma", "Jira"], cgpa: 7.0, min: 900000, max: 1500000, d: "Partner with design and engineering to define and ship learning features. Write specs, analyse funnel data and run user interviews." },
  { t: "Digital Marketing Executive", c: "Bloom Brands", l: "Jaipur, Rajasthan", m: "ONSITE", cat: "Marketing", req: ["SEO", "Social Media Marketing", "Content Writing"], pref: ["Google Analytics", "Canva"], min: 300000, max: 500000, d: "Plan and run multi-channel campaigns, track performance in analytics tools and produce weekly insight reports." },
  { t: "Java Developer", c: "Ironbridge Banking Tech", l: "Chennai, Tamil Nadu", m: "ONSITE", lv: "JUNIOR", cat: "Backend Development", req: ["Java", "Spring Boot", "SQL", "REST APIs"], pref: ["Microservices", "Docker", "Kafka"], min: 700000, max: 1200000, d: "Build microservices for core banking workflows with a strong focus on reliability, testing and security." },
  { t: ".NET Developer", c: "Sapphire Enterprise", l: "Kolkata, West Bengal", m: "HYBRID", lv: "JUNIOR", cat: "Backend Development", req: ["C#", ".NET", "SQL", "REST APIs"], pref: ["Azure", "Entity Framework"], min: 600000, max: 1000000, d: "Develop and enhance enterprise web applications using .NET. Participate in design reviews and sprint planning." },
  { t: "Database Administrator Trainee", c: "Tessera Data Services", l: "Noida, Uttar Pradesh", m: "ONSITE", cat: "Data & Analytics", req: ["SQL", "PostgreSQL", "Linux"], pref: ["Backup & Recovery", "Performance Tuning"], cgpa: 6.5, min: 400000, max: 650000, d: "Learn to administer production PostgreSQL clusters: backups, replication, indexing and query tuning, under senior DBA guidance." },
  { t: "Software Development Intern", c: "Zenith Software", l: "Remote (India)", ty: "INTERNSHIP", m: "REMOTE", cat: "Software Engineering", req: ["Python", "Git"], pref: ["JavaScript", "SQL", "Data Structures"], min: 10000, max: 20000, d: "Work on internal tools with a mentor, fix bugs, write tests and ship small features during a 3-month remote internship." },
  { t: "Web Development Intern (MERN)", c: "Cascade Startups Hub", l: "Indore, Madhya Pradesh", ty: "INTERNSHIP", m: "HYBRID", cat: "Web Development", req: ["JavaScript", "React", "Node.js"], pref: ["MongoDB", "Express.js", "Git"], min: 8000, max: 15000, d: "Join a small product team building MVPs for early-stage startups. Great exposure to the full MERN stack with real client deadlines." },
  { t: "Technical Content Writer", c: "Quillcraft Media", l: "Remote (India)", m: "REMOTE", ty: "PART_TIME", cat: "Marketing", req: ["Technical Writing", "Communication"], pref: ["Markdown", "Git", "SEO"], min: 200000, max: 400000, d: "Write tutorials, documentation and blog posts for developer tools. Ability to explain code clearly is required." },
  { t: "Embedded Systems Engineer", c: "Voltaic Devices", l: "Pune, Maharashtra", m: "ONSITE", lv: "JUNIOR", cat: "Hardware & IoT", req: ["C", "C++", "Microcontrollers"], pref: ["RTOS", "Python"], cgpa: 7.0, min: 600000, max: 1000000, d: "Develop firmware for IoT sensors, debug on hardware and collaborate with electronics engineers on new product lines." },
  { t: "Senior Full Stack Engineer", c: "Atlas Platform", l: "Bengaluru, Karnataka", m: "HYBRID", lv: "SENIOR", cat: "Web Development", req: ["TypeScript", "React", "Node.js", "PostgreSQL", "System Design"], pref: ["AWS", "Kubernetes", "GraphQL"], min: 2500000, max: 4000000, d: "Lead architecture of core platform services, mentor engineers and drive technical roadmap together with product leadership." },
  { t: "Customer Success Associate", c: "Harbor CRM", l: "Remote (India)", m: "REMOTE", cat: "Support", req: ["Communication", "Problem Solving"], pref: ["SQL", "CRM Tools"], min: 300000, max: 500000, d: "Onboard new customers, run product training sessions and collect feedback to share with the product team." },
];

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@careermatch.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "Admin@12345";
  await prisma.user.upsert({
    where: { email },
    create: { email, fullName: "CareerMatch Admin", role: "ADMIN", emailVerified: true, onboardingComplete: true, passwordHash: await bcrypt.hash(password, 12), profile: { create: {} } },
    update: { role: "ADMIN" },
  });
  console.log(`Admin ready: ${email}`);

  let n = 0;
  for (const [i, j] of jobs.entries()) {
    const externalId = `sample-${String(i + 1).padStart(3, "0")}`;
    const data = {
      title: j.t, company: j.c, location: j.l, workMode: j.m ?? "ONSITE", type: j.ty ?? "FULL_TIME", experienceLevel: j.lv ?? "FRESHER",
      description: `${j.d}\n\n[Demonstration listing — fictional company and role created for this project. Not a real job opening.]`,
      requiredSkills: j.req, preferredSkills: j.pref ?? [], minCgpa: j.cgpa ?? null, salaryMin: j.min ?? null, salaryMax: j.max ?? null,
      category: j.cat, applyUrl: null, isSample: true, source: "SAMPLE", externalId, postedAt: new Date(Date.now() - (i % 20) * 86400_000),
    };
    await prisma.job.upsert({ where: { source_externalId: { source: "SAMPLE", externalId } }, create: data, update: data });
    n++;
  }
  console.log(`Seeded ${n} sample jobs/internships (flagged isSample=true).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
