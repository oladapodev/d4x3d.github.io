import { Github, Star, MapPin, Link as LinkIcon, Users } from 'lucide-react';
import { useGithubProfile, usePinnedRepos, useContributions, useGithubStatus } from '../hooks/useGithub';
import CommitGraph from '../components/CommitGraph';
import { formatLocalTime } from '../lib/time';

type Props = { username: string };

export default function GithubShowcase({ username }: Props) {
  // Disable auto-polling - rely on localStorage cache which has 10min TTL
  const profile = useGithubProfile(username, 0);
  const pinned = usePinnedRepos(username, 0);
  const contrib = useContributions(username, 0);
  const status = useGithubStatus();
  const effectiveUser = profile.data?.login || status?.username || username;

  return (
    <section className="max-w-7xl mx-auto mb-16 md:mb-20 animate-fade-in" style={{ animationDelay: '0.25s' }}>
      <div className="inline-flex items-center gap-2 bg-purple-300 border-4 border-black p-4 -rotate-1 shadow-[8px_8px_0_rgba(0,0,0,1)] mb-6">
        <Github className="w-6 h-6" />
        <span className="font-black uppercase">GitHub</span>
      </div>

      {/* Profile */}
      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        <div className="bg-yellow-200 border-4 border-black p-6 rotate-1 shadow-[8px_8px_0_rgba(0,0,0,1)]">
          {profile.loading ? (
            <div className="h-24 bg-black/10 animate-pulse" />
          ) : profile.data ? (
            <div className="flex items-center gap-4">
              <img src={profile.data.avatar_url} alt="avatar" className="w-16 h-16 rounded border-4 border-black" />
              <div>
                <p className="font-black">{profile.data.name ?? profile.data.login}</p>
                <a href={profile.data.html_url} target="_blank" className="underline">@{profile.data.login}</a>
                {profile.data.bio && <p className="text-sm mt-1 opacity-80">{profile.data.bio}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-sm opacity-90">
                  {profile.data.location && (
                    <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{profile.data.location}</span>
                  )}
                  <span className="inline-flex items-center gap-1">🕒 {formatLocalTime(profile.data.location)}</span>
                  {profile.data.blog && (
                    <a href={(profile.data.blog.startsWith('http') ? '' : 'https://') + profile.data.blog} target="_blank" className="inline-flex items-center gap-1 underline"><LinkIcon className="w-4 h-4" />Website</a>
                  )}
                  <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" />{profile.data.followers} followers</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm">{profile.error ?? 'Profile unavailable'}</p>
          )}
        </div>

        {/* Pinned / Recent */}
        <div className="md:col-span-2 bg-cyan-200 border-4 border-black p-6 -rotate-1 shadow-[-8px_8px_0_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5" />
            <p className="font-black">Pinned Projects</p>
          </div>
          {pinned.loading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-black/10 animate-pulse" />
              ))}
            </div>
          ) : pinned.data ? (
            <div className="grid md:grid-cols-3 gap-4">
              {pinned.data.map((r: any) => (
                <a
                  key={r.id}
                  href={r.url || r.html_url}
                  target="_blank"
                  className="block bg-white border-4 border-black p-4 rotate-1 hover:-rotate-1 shadow-[6px_6px_0_rgba(0,0,0,1)] transition-transform"
                >
                  <p className="font-black mb-1">{r.name}</p>
                  {r.description && <p className="text-sm opacity-80 line-clamp-3">{r.description}</p>}
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <Star className="w-4 h-4" />
                    <span>{r.stargazerCount ?? r.stargazers_count ?? 0}</span>
                    {r.primaryLanguage?.name || r.language ? (
                      <span className="ml-auto opacity-80">{r.primaryLanguage?.name || r.language}</span>
                    ) : null}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm">{pinned.error ?? 'No projects found'}</p>
          )}
        </div>
      </div>

      {/* Contributions */}
      <div className="mt-8 bg-pink-200 border-4 border-black p-6 rotate-2 shadow-[8px_-8px_0_rgba(0,0,0,1)]">
        <p className="font-black mb-3">Contribution Graph</p>
        {contrib.enabled ? (
          contrib.loading ? (
            <div className="h-20 bg-black/10 animate-pulse" />
          ) : contrib.data ? (
            <CommitGraph days={contrib.data} />
          ) : (
            <p className="text-sm">{contrib.error ?? 'No data'}</p>
          )
        ) : (
          <p className="text-sm text-gray-500">GitHub token not configured. Set GITHUB_TOKEN in Cloudflare Pages variables.</p>
        )}
      </div>
    </section>
  );
}
