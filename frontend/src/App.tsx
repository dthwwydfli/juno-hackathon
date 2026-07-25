import { Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './screens/landing/Landing';
import { Auth } from './screens/auth/Auth';
import { Onboarding } from './screens/onboarding/Onboarding';
import { Home } from './screens/home/Home';
import { Add } from './screens/add/Add';
import { Interactions } from './screens/interactions/Interactions';
import { ReadMore } from './screens/readmore/ReadMore';
import { Share } from './screens/share/Share';
import { Settings } from './screens/settings/Settings';
import { NhsConnection } from './screens/nhs-connection/NhsConnection';
import { Archive } from './screens/archive/Archive';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/home" element={<Home />} />
      <Route path="/add" element={<Add />} />
      <Route path="/add/:id" element={<Add />} />
      <Route path="/interactions" element={<Interactions />} />
      <Route path="/interactions/:id" element={<ReadMore />} />
      <Route path="/share" element={<Share />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/nhs" element={<NhsConnection />} />
      <Route path="/archive" element={<Archive />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
