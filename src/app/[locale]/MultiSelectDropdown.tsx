"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export default function MultiSelectDropdown({ 
  options, 
  selected, 
  onChange, 
  placeholder 
}: { 
  options: { label: string, value: string }[], 
  selected: string[], 
  onChange: (selected: string[]) => void, 
  placeholder: string 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText = selected.length === 0 
    ? `All ${placeholder}` 
    : selected.length === 1 
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} Selected`;

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 flex items-center justify-between"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-xl shadow-black/50 max-h-60 overflow-y-auto overflow-x-hidden p-1.5 scrollbar-thin scrollbar-thumb-slate-700 flex flex-col gap-0.5">
          <div className="sticky top-0 bg-slate-900 pb-1.5 z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {filteredOptions.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">No options found</div>
          ) : (
            filteredOptions.map(option => (
              <label key={option.value} className="flex items-center gap-2.5 p-2 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                  />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${selected.includes(option.value) ? "bg-amber-500 border-amber-500" : "bg-slate-950 border-slate-700 group-hover:border-amber-500/50"}`}>
                    {selected.includes(option.value) && <Check className="w-3 h-3 text-slate-950 stroke-[3]" />}
                  </div>
                </div>
                <span className={`text-sm truncate ${selected.includes(option.value) ? "text-amber-400 font-medium" : "text-slate-300"}`}>
                  {option.label}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
