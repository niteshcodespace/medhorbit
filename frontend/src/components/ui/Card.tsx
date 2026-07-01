type CardProps = {
  children: React.ReactNode;
};

export default function Card({ children }: CardProps) {
  return (
    <div
      className="
      rounded-2xl
      bg-white/5
      p-6
      backdrop-blur
      border
      border-white/10
      "
    >
      {children}
    </div>
  );
}