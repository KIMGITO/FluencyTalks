import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { reportClientError } from '@/lib/appLog';
import { ErrorState } from './ErrorState';

/** A page that crashed. Staff read the details on the Logs page; the person sees none of them. */
export function RouteError() {
  const error = useRouteError() as Error | undefined;
  useEffect(() => { void reportClientError(error?.message ?? 'Page crashed', error?.stack); }, [error]);
  return (
    <div className="mx-auto w-full max-w-xl p-4">
      <ErrorState title="This page hit a problem" text="It's not something you did. Your account and messages are safe. Try loading it again." onRetry={() => window.location.reload()} />
      <p className="mt-3 text-center text-sm"><a className="font-semibold text-brand underline" href="/home">Go to the home page</a></p>
    </div>
  );
}
