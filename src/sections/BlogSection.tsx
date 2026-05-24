import { Link } from 'react-router-dom';
import { useBlogPosts } from '../hooks/useBlog';
import SectionHeader from '../components/SectionHeader';
import { Code } from 'lucide-react';

export default function BlogSection() {
  const { posts } = useBlogPosts();
  const latest = (posts || []).slice(0, 2);

  return (
    <section className="max-w-7xl mx-auto mb-16 md:mb-20 animate-fade-in" style={{ animationDelay: '0.26s' }}>
      <SectionHeader label="Blog" icon={Code} bgColor="bg-cyan-300" rotate="" />
      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {latest.map((p) => (
          <article
            key={p.slug}
            className="bg-yellow-200 border-4 border-black p-6 shadow-[8px_8px_0_rgba(0,0,0,1)] hover:shadow-[10px_10px_0_rgba(0,0,0,1)] transition-all"
          >
            <h3 className="font-black text-xl mb-2">{p.title}</h3>
            <p className="text-sm opacity-80 mb-3 font-medium">{new Date(p.createdAt).toDateString()}</p>
            <p className="text-sm text-gray-700">{p.summary}</p>
          </article>
        ))}
      </div>
      <Link
        to="/blog"
        className="inline-block mt-6 bg-blue-400 border-4 border-black px-6 py-2 shadow-[8px_8px_0_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[6px_6px_0_rgba(0,0,0,1)] transition-all font-black"
      >
        Go to Blog
      </Link>
    </section>
  );
}
