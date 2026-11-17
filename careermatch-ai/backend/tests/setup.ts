process.env.NODE_ENV = "test";
process.env.EMAIL_TRANSPORT = "console";
process.env.ANTHROPIC_API_KEY = "";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
