import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock4Icon, LogOut } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, Spinner } from '@/components/ui';
import {
  CountryBadge,
  FollowButton,
  LanguageChip,
  MessageButton,
  UserMenu,
} from '@/components/features';
import { deleteAccount, getProfile } from '@/services';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { useCountries } from '@/store/countryStore';
import { useDisplayLocales, useLanguageStore } from '@/store/languageStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import type { FullProfile } from '@/types/db';
import { actionBtn } from '@/components/features/ActionButtonStyle';
import { C } from '@/theme/theme';

export default function UserProfile() {
  const { username = '' } = useParams();
  const labelOf = useLanguageStore((s) => s.labelOf);
  const locales = useDisplayLocales();
  useCountries();
  const [profile, setProfile] = useState<FullProfile | null | undefined>(
    undefined,
  );
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setProfile(undefined);
    getProfile(username)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [username]);
  const signOut = useAuthStore((s) => s.signOut);
  const role = useProfileStore((s) => s.me?.role);
  const staff = role === 'admin' || role === 'moderator';
  const providerAvatar = useProviderAvatar();

  if (profile === undefined)
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  // Same screen for "doesn't exist" and "blocked you": blocking stays silent.
  if (profile === null)
    return (
      <EmptyState
        title="Profile unavailable"
        text="This profile doesn't exist or isn't available."
        action={
          <Link to="/search">
            <Button>Search people</Button>
          </Link>
        }
      />
    );
  const r = profile.relationship;
  const onDelete = async () => {
    if (
      !confirm('Delete your account and all your data? This cannot be undone.')
    )
      return;
    try {
      await deleteAccount();
      await signOut();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {msg && <p className="text-sm text-danger">{msg}</p>}
      <Card className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Avatar
            name={profile.display_name}
            src={
              r.is_me
                ? resolveAvatar(profile.avatar_url, providerAvatar)
                : profile.avatar_url
            }
            size="lg"
            ring
          />
          <div className="min-w-0 flex-1">
           <div className="flex items-center justify-between">
             <h1 className="truncate text-xl font-bold">
              {profile.display_name}
            </h1>
             {profile.timezone && (
                <span className="truncate flex items-end gap-0.5 text-aqua text-[10px] self-start ">
                  {' '}
                   <Clock4Icon size={16}/> {profile.timezone}
                </span>
              )}
           </div>
            <p className="flex flex-col items-start gap-x-2 gap-y-0.5 truncate text-sm text-muted">
              <div className="flex items-center gap-2">
                <span className="truncate">@{profile.username}</span>
                <CountryBadge
                  code={profile.country_code}
                  timezone={profile.timezone}
                  showName
                />
              </div>
             
            </p>
            <p className="mt-0.5 text-xs text-muted">
              <Link
                to={`/u/${profile.username}/followers`}
                className="hover:underline"
              >
                <b className="text-ink">{profile.followers_count}</b> followers
              </Link>{' '}
              ·{' '}
              <Link
                to={`/u/${profile.username}/following`}
                className="hover:underline"
              >
                <b className="text-ink">{profile.following_count}</b> following
              </Link>
            </p>
          </div>
          {!r.is_me && (
            <UserMenu
              userId={profile.id}
              name={profile.display_name}
              onBlocked={() => setProfile(null)}
            />
          )}
        </div>
        {profile.bio && (
          <div className="text-xs items-center text-ink flex flex-wrap md:w-1/2 lg:w-1/3 font-light leading-loose ">
            <p> {profile.bio}</p>
          </div>
        )}
        <div className="ft-chips">
          <LanguageChip
            className="mt-2"
            languages={profile.languages.map((l) => ({
              language: labelOf(l, locales),
              level: l.level,
            }))}
          />
        </div>
        <div className="flex  justify-end items-center gap-1.5">
          {r.is_me ? (
            <>
              <Link to="/profile/edit">
                <Button
                  size="sm"
                  variant={'primary'}
                  className={`${actionBtn} transition-colors`}
                >
                  Edit profile
                </Button>
              </Link>
              {/* <Link to="/settings">
                <Button
                  size="sm"
                  variant={'ghost'}
                  className={`${actionBtn} transition-colors`}
                >
                  Settings
                </Button>
              </Link> */}
            </>
          ) : (
            <>
              <FollowButton userId={profile.id} initial={r.following} />
              <MessageButton userId={profile.id} />
              {r.follows_me && (
                <span className="text-xs text-muted">Follows you</span>
              )}
            </>
          )}
        </div>
      </Card>
      {r.is_me && (
        <Card className="flex flex-col gap-2 bg-danger/5 ">
          <div className="flex  items-center justify-between ">
            <div className="flex flex-col gap-1">
              <h2 className="flex items-center gap-2 font-semibold  text-danger">
                <LogOut size={15} /> Session & account
              </h2>
              {staff && (
                <Link to="/admin">
                  <Button variant="secondary" size="sm" className="self-start">
                    Moderation
                  </Button>
                </Link>
              )}
              <p className="text-xs text-danger">Sign out on this device.</p>
            </div>
            <Button
              // variant="danger"
              size="sm"
              className={`${actionBtn}  bg-danger  self-center`}
              onClick={signOut}
            >
              Log out
            </Button>
          </div>
          <div className="border-t border-border pt-2">
            <p className="font-semibold text-danger">Delete account</p>
            <p className="text-xs text-danger">
              Permanently removes your account, messages and profile.{' '}
              <Link to="/data-deletion" className="underline">
                How deletion works
              </Link>
            </p>
            <Button
              variant="danger"
              size="sm"
              className={`${actionBtn}  bg-danger  self-start mt-4`}

              onClick={onDelete}
            >
              Delete account
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
