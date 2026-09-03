import React from 'react';

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none transition-opacity duration-300 dark:opacity-100 opacity-20">
      {/* Glow Blobs */}
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-indigo-600/20 dark:bg-indigo-600/25 blur-[120px] animate-pulse-slow" />
      <div 
        className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-purple-600/20 dark:bg-purple-600/25 blur-[120px] animate-pulse-slow" 
        style={{ animationDelay: '1.5s' }} 
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[850px] rounded-full bg-blue-600/5 blur-[160px]" />
      
      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,#1f293720_1px,transparent_1px),linear-gradient(to_bottom,#1f293720_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_50%,#000_75%,transparent_100%)]" 
      />
    </div>
  );
}
