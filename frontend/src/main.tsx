import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";
import { ApiClientError } from "./api/client";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Conference wifi is shared and flaky — a single dropped request
      // shouldn't surface as a user-facing error. Retry transient failures
      // (network errors, 5xx) up to twice, but never retry a 4xx: those are
      // the server correctly rejecting the request (bad auth, validation,
      // not found), and retrying them just adds load without ever succeeding.
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      // Without this, every remount (e.g. switching tabs and back) treats
      // cached data as stale and refetches immediately — at a couple
      // thousand concurrent devices that's a lot of avoidable requests for
      // data that rarely changes second-to-second. 30s keeps the UI feeling
      // live while cutting that redundant traffic.
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
