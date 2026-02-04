import React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
  stack?: string;
  componentStack?: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return { hasError: true, message, stack };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);

    this.setState({
      hasError: true,
      message,
      stack,
      componentStack: info.componentStack,
    });
  }

  private formatDetails() {
    const { message, stack, componentStack } = this.state;
    return [
      "=== Error ===",
      message ?? "(sem mensagem)",
      "",
      "=== Stack ===",
      stack ?? "(sem stack)",
      "",
      "=== Component Stack ===",
      componentStack ?? "(sem component stack)",
    ].join("\n");
  }

  private reset = () => {
    this.setState({ hasError: false, message: undefined, stack: undefined, componentStack: undefined });
  };

  private copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(this.formatDetails());
    } catch (e) {
      console.error("[ErrorBoundary] Failed to copy details:", e);
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground p-4">
        <Card>
          <CardHeader>
            <CardTitle>Ocorreu um erro nesta tela</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Detalhes capturados</AlertTitle>
              <AlertDescription>
                A tela não vai mais ficar branca: abaixo está o erro real para a gente corrigir.
              </AlertDescription>
            </Alert>

            <div className="rounded-md border bg-muted/30 p-3">
              <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
                {this.formatDetails()}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="default" onClick={() => window.location.reload()}>
                Recarregar
              </Button>
              <Button type="button" variant="outline" onClick={this.reset}>
                Tentar continuar
              </Button>
              <Button type="button" variant="outline" onClick={this.copyDetails}>
                Copiar detalhes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
