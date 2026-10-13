import { LoaderCircle } from "lucide-react";
import AuthProvider from "./context/AuthProvider";
import { useAuth } from "./context/useAuth";
import AuthPage from "./pages/AuthPage/AuthPage";
import ChatPage from "./pages/ChatPage/ChatPage";

function Gate() {
  const { user, isCheckingSession } = useAuth();

  if (isCheckingSession) {
    return (
      <div className="splash" role="status" aria-label="Loading">
        <LoaderCircle className="spin" size={28} />
      </div>
    );
  }

  // key resets all chat state when a different user logs in
  return user ? <ChatPage key={user.id} /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
