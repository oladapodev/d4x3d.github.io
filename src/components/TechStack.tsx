import StackIcon from 'tech-stack-icons';

const items = [
  { name: 'react', label: 'React', bg: 'bg-cyan-200', rotate: 'rotate-1' },
  { name: 'typescript', label: 'TypeScript', bg: 'bg-blue-200', rotate: '-rotate-1' },
  { name: 'js', label: 'JavaScript', bg: 'bg-amber-200', rotate: 'rotate-2' },
  { name: 'nodejs', label: 'Node.js', bg: 'bg-green-200', rotate: '-rotate-2' },
  { name: 'tailwindcss', label: 'Tailwind', bg: 'bg-emerald-200', rotate: 'rotate-3' },
  { name: 'threejs', label: 'Three.js', bg: 'bg-zinc-200', rotate: '-rotate-3' },
  { name: 'vite', label: 'Vite', bg: 'bg-purple-200', rotate: 'rotate-1' },
  { name: 'nextjs', label: 'Next.js', bg: 'bg-slate-200', rotate: '-rotate-1' },
  { name: 'docker', label: 'Docker', bg: 'bg-sky-200', rotate: 'rotate-2' },
  { name: 'postgresql', label: 'PostgreSQL', bg: 'bg-blue-100', rotate: 'rotate-3' },
  { name: 'mongodb', label: 'MongoDB', bg: 'bg-green-100', rotate: '-rotate-3' },
  { name: 'git', label: 'Git', bg: 'bg-orange-200', rotate: 'rotate-1' },
  { name: 'linux', label: 'Linux', bg: 'bg-yellow-200', rotate: '-rotate-1' },
  { name: 'python', label: 'Python', bg: 'bg-lime-200', rotate: 'rotate-2' },
];

export default function TechStack() {
  return (
    <div className="grid grid-cols-3 md:grid-cols-9 gap-4">
      {items.map((it) => (
        <div key={it.name} className={`${it.bg} border-4 border-black p-3 ${it.rotate} shadow-[6px_6px_0_rgba(0,0,0,1)] flex flex-col items-center justify-center`}>
          <StackIcon name={it.name as any} className="w-10 h-10" />
          <p className="text-xs font-black mt-2 text-center">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
