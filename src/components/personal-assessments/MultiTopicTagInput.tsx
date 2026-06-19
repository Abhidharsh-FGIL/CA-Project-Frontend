import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import { WeightageEditor } from '@/components/personal-assessments/WeightageEditor';
import { distributeEvenly } from '@/lib/distribution-utils';

interface MultiTopicTagInputProps {
  topics: string[];
  topicWeightage: Record<string, number>;
  onChange: (topics: string[], weightage: Record<string, number>) => void;
}

export function MultiTopicTagInput({ topics, topicWeightage, onChange }: MultiTopicTagInputProps) {
  const [newTopic, setNewTopic] = useState('');

  const addTopic = () => {
    const trimmed = newTopic.trim();
    if (!trimmed || topics.includes(trimmed)) return;
    const updated = [...topics, trimmed];
    onChange(updated, distributeEvenly(updated));
    setNewTopic('');
  };

  const removeTopic = (topic: string) => {
    const updated = topics.filter(t => t !== topic);
    onChange(updated, distributeEvenly(updated));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTopic();
    }
  };

  return (
    <div className="space-y-3">
      {/* Tag display */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.map(topic => (
            <Badge key={topic} variant="secondary" className="gap-1 pr-1">
              {topic}
              <button
                type="button"
                onClick={() => removeTopic(topic)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <Input
          value={newTopic}
          onChange={e => setNewTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a topic and press Enter or +"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={addTopic}
          disabled={!newTopic.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {topics.length > 0 && topics.length < 2 && (
        <p className="text-xs text-destructive">At least 2 topics required.</p>
      )}

      {/* Weightage editor */}
      {topics.length >= 2 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Topic Weightage</Label>
          <WeightageEditor
            items={topics.map(t => ({ key: t, label: t }))}
            weights={topicWeightage}
            onChange={(w) => onChange(topics, w)}
          />
        </div>
      )}
    </div>
  );
}
