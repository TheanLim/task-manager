import type { Metadata } from "next";
import "./globals.css";
import "./quill-custom.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TabSyncProvider } from "@/components/TabSyncProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Task Management App",
  description: "A task management web application with integrated time management methodologies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ErrorBoundary>
          <ThemeProvider>
            <TabSyncProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </TabSyncProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
