"use client";

import React, { useState } from 'react';
import { Loader2, Wand2, Database, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMetadata } from '@/contexts/MetadataContext';

const AI_MODELS = [
    { id: 'llama-3.1-8b-instant', name: 'Meta Llama 3.1 8B (Fast)' },
    { id: 'llama-3.3-70b-versatile', name: 'Meta Llama 3.3 70B (Smart)' },
    { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B' },
    { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B' },
];

const MODES = [
    { id: 'section-a', name: 'Paper A (50 Qs)' },
    { id: 'section-b', name: 'Paper B (50 Qs)' },
    { id: 'section-c', name: 'Paper C (50 Qs)' },
    { id: 'full-exam', name: 'Full Exam (A+B+C, 150 Qs)' },
    { id: 'custom', name: 'Subject Wise (Custom)' }
];

const BRANCH_SUBJECTS: Record<string, string[]> = {
    'section-a': [
        'English', 'Quantitative Aptitude', 'Reasoning', 'Computer Fundamentals & Concepts of Programming'
    ],
    'section-b': [
        'C Programming', 'Data Structures', 'Object Oriented Programming Concepts using C++',
        'Operating Systems & Networking', 'Basics of Big Data & Artificial Intelligence'
    ],
    'section-c': [
        'Computer Architecture', 'Digital Electronics', 'Microprocessors'
    ]
};

export default function AIContestGenerator() {
    const { user, userInfo } = useAuth();
    const { selectedBranch } = useMetadata();
    const [status, setStatus] = useState<'idle' | 'generating' | 'seeding' | 'success' | 'error'>('idle');
    const [log, setLog] = useState<string>('');
    const [model, setModel] = useState(AI_MODELS[0].id);
    const [mode, setMode] = useState(MODES[0].id);
    const [customSubject, setCustomSubject] = useState(BRANCH_SUBJECTS['section-a'][0]);
    const [customCount, setCustomCount] = useState(10);
    const [contestTitle, setContestTitle] = useState('');
    const [difficulty, setDifficulty] = useState('Medium');
    const [isPublic, setIsPublic] = useState(false);
    const [isRated, setIsRated] = useState(false);

    const appendLog = (msg: string) => setLog(prev => prev + `\n${new Date().toLocaleTimeString()}: ${msg}`);

    const generateAIContest = async () => {
        if (!user) {
            appendLog('Error: Authentication required.');
            return;
        }

        setStatus('generating');
        setLog(`Initializing AI Contest Generation...\nModel: ${model}\nMode: ${mode}`);

        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/admin/generate-ai-contest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    model,
                    mode,
                    branch: selectedBranch || 'bda',
                    customSubject,
                    customCount,
                    contestTitle: contestTitle || `AI Generated ${MODES.find(m => m.id === mode)?.name} Test`,
                    difficulty,
                    isPublic,
                    isRated,
                    uid: user.uid
                }),
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error("No readable stream available.");

            let accumulatedText = "";
            let finalResult = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;
                
                // Process JSON lines if the stream sends progress updates
                const lines = accumulatedText.split('\n');
                accumulatedText = lines.pop() || ''; // Keep the incomplete line for the next chunk

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.log) {
                                appendLog(parsed.log);
                            }
                            if (parsed.status === 'success') {
                                setStatus('success');
                                finalResult = parsed;
                                appendLog(`✅ Successfully created contest: ${parsed.contestId}`);
                            }
                            if (parsed.error) {
                                setStatus('error');
                                appendLog(`❌ Error: ${parsed.error}`);
                            }
                        } catch (e) {
                            // Sometimes JSON lines can be fragmented, but we split by \n.
                        }
                    }
                }
            }

            if (accumulatedText.trim()) {
                try {
                    const parsed = JSON.parse(accumulatedText);
                    if (parsed.status === 'success') {
                        setStatus('success');
                        appendLog(`✅ Successfully created contest: ${parsed.contestId}`);
                    }
                    if (parsed.error) {
                        setStatus('error');
                        appendLog(`❌ Error: ${parsed.error}`);
                    }
                } catch (e) { }
            }

            if (status !== 'error') {
                setStatus('success');
            }

        } catch (error: any) {
            setStatus('error');
            appendLog(`❌ Critical Error: ${error.message}`);
        }
    };

    const allSubjects = [...BRANCH_SUBJECTS['section-a'], ...BRANCH_SUBJECTS['section-b'], ...BRANCH_SUBJECTS['section-c']];

    return (
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm mt-8">
            <div className="flex flex-col gap-1 border-b border-gray-100 dark:border-zinc-800 pb-4 mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                    <Database className="w-5 h-5 text-indigo-500" />
                    AI Contest Generator (Groq LLM)
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Generate full C-CAT formats, seed DB, and instantly create an exam via LLM.</p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-indigo-50/30 dark:bg-zinc-900/40 p-4 rounded-xl border border-indigo-100/50 dark:border-zinc-800/50">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Model Selection</label>
                        <select
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            disabled={status === 'generating'}
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Exam Structure</label>
                        <select
                            value={mode}
                            onChange={e => setMode(e.target.value)}
                            disabled={status === 'generating'}
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {MODES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    {mode === 'custom' && (
                        <>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
                                <select
                                    value={customSubject}
                                    onChange={e => setCustomSubject(e.target.value)}
                                    disabled={status === 'generating'}
                                    className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {allSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Question Count</label>
                                <input
                                    type="number"
                                    min="1" max="50"
                                    value={customCount}
                                    onChange={e => setCustomCount(Number(e.target.value))}
                                    disabled={status === 'generating'}
                                    className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Contest Title (Optional)</label>
                        <input
                            type="text"
                            value={contestTitle}
                            onChange={e => setContestTitle(e.target.value)}
                            placeholder="Auto-generated if empty"
                            disabled={status === 'generating'}
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div className="flex items-center justify-between col-span-1 md:col-span-2 pt-2">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} disabled={status === 'generating'} className="rounded" />
                            Make Public
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={isRated} onChange={e => setIsRated(e.target.checked)} disabled={status === 'generating'} className="rounded" />
                            Make Rated
                        </label>
                    </div>
                </div>

                <div className="bg-black/5 dark:bg-black/30 p-4 rounded-xl text-xs font-mono text-gray-800 dark:text-gray-300 min-h-[8rem] max-h-[16rem] overflow-y-auto whitespace-pre-wrap shadow-inner border border-gray-200 dark:border-zinc-800">
                    {log || "> Waiting for user input. Select model and structure to generate..."}
                </div>

                <button
                    onClick={generateAIContest}
                    disabled={status === 'generating'}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50 text-base"
                >
                    {status === 'generating' ? <Loader2 className="animate-spin w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                    {status === 'generating' ? 'GENERATING...' : 'GENERATE EXAM (AI)'}
                </button>
            </div>
        </div>
    );
}
