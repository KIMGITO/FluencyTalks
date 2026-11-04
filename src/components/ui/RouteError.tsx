import { Component, useEffect, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { reportClientError } from '@/lib/appLog';
import { ErrorState } from './ErrorState';

const CrashScreen = () => (
  <div className="mx-auto w-full max-w-xl p-4">
    <ErrorState title="Oops! Something went wrong" text="It's not something you did. Your account and messages are safe. Try loading the page again." onRetry={() => window.location.reload()} />
    <p className="mt-3 text-center text-sm"><a className="font-semibold text-brand underline" href="/home">Go to the home page</a></p>
  </div>
);

/** A page that crashed. Staff read the details on the Logs page; the person sees none of them. */
export function RouteError() {
  const error = useRouteError() as Error | undefined;
  useEffect(() => { void reportClientError(error?.message ?? 'Page crashed', error?.stack); }, [error]);
  return <CrashScreen />;
}

/** The last net, for a crash outside any route. Without it the app goes blank. */
export class CrashBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error: Error) { void reportClientError(error.message || 'App crashed', error.stack); }
  render() { return this.state.crashed ? <CrashScreen /> : this.props.children; }
}
