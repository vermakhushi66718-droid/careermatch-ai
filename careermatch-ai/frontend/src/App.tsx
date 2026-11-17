import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { PublicOnly, RequireAdmin, RequireAuth } from "./components/Guards";
import Landing from "./pages/Landing";
import { ForgotPassword, Login, Register, ResetPassword, VerifyEmail } from "./pages/AuthPages";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import ResumePage from "./pages/Resume";
import Roadmaps from "./pages/Roadmaps";
import Interviews from "./pages/Interviews";
import InterviewSessionPage from "./pages/InterviewSession";
import Applications from "./pages/Applications";
import Assistant from "./pages/Assistant";
import ProfilePage from "./pages/Profile";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminJobs from "./pages/admin/AdminJobs";
import AdminUsers from "./pages/admin/AdminUsers";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/roadmaps" element={<Roadmaps />} />
          <Route path="/interviews" element={<Interviews />} />
          <Route path="/interviews/:id" element={<InterviewSessionPage />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/jobs" element={<AdminJobs />} />
            <Route path="/admin/users" element={<AdminUsers />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
