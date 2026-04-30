import { PromptGuardWorkspaceShell } from "../../components/promptguard-workspace-shell";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PromptGuardWorkspaceShell>{children}</PromptGuardWorkspaceShell>;
}
