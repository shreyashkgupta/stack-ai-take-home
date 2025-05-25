"use client";

import { useState, useCallback, useEffect } from "react";
import { FilePicker } from "@/components/file-picker";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { isAuthenticated, isLoading, orgId, login, logout, error } = useAuth();
  const [connectionId, setConnectionId] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed", error);
    }
  }, [login]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleCreateKnowledgeBase = useCallback((knowledgeBase: Record<string, unknown>) => {
    toast.success(`Knowledge base "${knowledgeBase.name || 'New KB'}" created successfully`);
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const storedConnectionId = localStorage.getItem('stackAI_connectionId');
        if (storedConnectionId && orgId) {
          setConnectionId(storedConnectionId);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };
    
    if (orgId) {
      initializeApp();
    }
  }, [orgId]);

  const handleConnectDrive = useCallback(() => {
    const connId = process.env.NEXT_PUBLIC_DEFAULT_CONNECTION_ID || 'e171b021-8c00-4c3f-8a93-396095414f57';
    setConnectionId(connId);
    localStorage.setItem('stackAI_connectionId', connId);
    toast.success("Google Drive connected successfully");
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Stack AI File Picker</CardTitle>
            <CardDescription>
              Connect your Google Drive account to get started
            </CardDescription>
          </CardHeader>
          {error && (
            <CardContent>
              <p className="text-destructive">{error}</p>
            </CardContent>
          )}
          <CardFooter>
            <Button className="w-full" onClick={handleLogin}>
              Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <main className="container mx-auto py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">File Picker</h1>
          <p className="text-muted-foreground">
            Select files from your Google Drive to index
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout}>Logout</Button>
      </div>

      {orgId ? (
        connectionId ? (
          <div className="h-[600px]">
            <FilePicker
              connectionId={connectionId}
              orgId={orgId}
              onCreateKnowledgeBase={handleCreateKnowledgeBase}
              className="h-full"
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Connect Google Drive</CardTitle>
              <CardDescription>
                Connect your Google Drive account to browse and select files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleConnectDrive}>
                Connect Google Drive
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      )}
    </main>
  );
}
