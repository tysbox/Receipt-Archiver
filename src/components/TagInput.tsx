import { useState, useRef, KeyboardEvent } from 'react';
import { X, Tag, Plus } from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}

const TAG_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) & 0xffffffff;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function TagBadge({
  tag,
  onRemove,
  size = 'md',
}: {
  tag: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium select-none',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        tagColor(tag)
      )}
    >
      <Tag className={cn('shrink-0', size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3')} />
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full hover:bg-black/10 p-0.5 transition"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

export function TagInput({ tags, onChange, suggestions = [], placeholder = 'タグを追加...', className }: Props) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  );

  const addTag = (value: string) => {
    const trimmed = value.trim().replace(/[,、]/g, '');
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '、' || e.key === ' ') {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* タグ表示エリア + 入力 */}
      <div
        className={cn(
          'flex flex-wrap gap-1.5 min-h-[40px] rounded-lg border bg-white px-2.5 py-1.5 cursor-text transition',
          focused ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <TagBadge key={tag} tag={tag} onRemove={() => removeTag(i)} />
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (input.trim()) addTag(input);
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] text-sm bg-transparent outline-none placeholder:text-slate-400"
        />
      </div>

      {/* サジェスト */}
      {focused && input && filteredSuggestions.length > 0 && (
        <div className="absolute z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 flex flex-wrap gap-1.5 max-w-xs">
          {filteredSuggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-medium transition hover:opacity-80',
                tagColor(s)
              )}
            >
              <Plus className="w-3 h-3" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 既存タグのサジェスト（入力なし時） */}
      {focused && !input && suggestions.filter((s) => !tags.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          <span className="text-[10px] text-slate-400 self-center">よく使うタグ：</span>
          {suggestions
            .filter((s) => !tags.includes(s))
            .slice(0, 6)
            .map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s);
                }}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-medium transition hover:opacity-80',
                  tagColor(s)
                )}
              >
                {s}
              </button>
            ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        Enter・スペース・カンマで追加 ／ Backspaceで削除
      </p>
    </div>
  );
}
