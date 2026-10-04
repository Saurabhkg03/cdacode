"use client";

import { useState, useRef } from 'react';
import { db } from '@/firebase';
import { collection, writeBatch, doc, setDoc, getDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { X, Upload, FileJson, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface JsonImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

// Types based on the structure in seed6.js and Question interface
interface ImportedQuestion {
    question_id: string;
    title?: string;
    subject: string;
    topic: string;
    year: string;
    branch: string;
    question_type: string;
    question_label?: string;
    question_html?: string;
    question_text?: string;
    question_images?: { original_url: string }[];
    explanation_html?: string;
    explanation_images?: { original_url: string }[];
    options: {
        label?: string;
        text_html?: string;
        text?: string;
        is_correct?: boolean;
    }[];
    nat_answer_min?: string;
    nat_answer_max?: string;
    tags?: string[];
}

export default function JsonImportModal({ isOpen, onClose, onSuccess }: JsonImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[] | null>(null);
    const [bulkSubject, setBulkSubject] = useState('');
    const [bulkTopic, setBulkTopic] = useState('');
    const [bulkTags, setBulkTags] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dynamic Collection Selection State
    const [selectedBranch, setSelectedBranch] = useState<string>("bda");
    const branches = ["bda"];

    if (!isOpen) return null;

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);
            setLogs([]);
            setProgress(0);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    let parsed = JSON.parse(content);
                    if (!Array.isArray(parsed)) {
                        parsed = [parsed];
                    }
                    setParsedQuestions(parsed);
                } catch (err: any) {
                    setError("Failed to parse JSON: " + err.message);
                    setParsedQuestions(null);
                }
            };
            reader.readAsText(selectedFile);
        }
    };

    // --- Helper Functions ported from seed6.js ---

    const extractOriginalImageUrls = (imageArray: any) => {
        if (!Array.isArray(imageArray)) return [];
        return imageArray.map((img: any) => img.original_url).filter(Boolean);
    };

    const cleanValue = (value: any) => {
        if (!value || value === "General" || value === "N/A" || value === "Unknown" || value === "UnknownYear" || value === "UnknownBranch") {
            return null;
        }
        return value;
    };

    const convertMapOfSetsToSortedArrays = (mapOfSets: Record<string, Set<string>>) => {
        const finalMap: Record<string, string[]> = {};
        for (const [key, set] of Object.entries(mapOfSets)) {
            finalMap[key] = Array.from(set).sort();
        }
        return finalMap;
    };

    const handleImport = async () => {
        if (!parsedQuestions || parsedQuestions.length === 0) {
            setError("No valid questions parsed from file.");
            return;
        }
        if (!selectedBranch) {
            setError("Please select a target branch.");
            return;
        }

        setIsUploading(true);
        setError(null);
        setLogs([]);
        setProgress(0);
        addLog(`Starting import process for Branch: ${selectedBranch}...`);

        try {
            const questions = parsedQuestions;
            const totalQuestionCount = questions.length;

            addLog(`✅ Processing ${totalQuestionCount} questions.`);

            // --- Part 1: Calculate Metadata ---
            addLog("Calculating metadata...");

                const subjectCounts: Record<string, number> = {};
                const topicCounts: Record<string, number> = {};
                const yearCounts: Record<string, number> = {};
                const branchCounts: Record<string, number> = {};
                const questionTypeCounts: Record<string, number> = {};

                const allBranches = new Set<string>();
                const allQuestionTypes = new Set<string>();
                const subjectTopicMap: Record<string, Set<string>> = {};
                const branchSubjectMap: Record<string, Set<string>> = {};
                const questionsForSorting: { id: string, title: string }[] = [];

                // 1. Metadata Calculation Pass
                for (const q of questions) {
                    const subject = cleanValue(q.subject);
                    const topic = cleanValue(q.topic);
                    const year = cleanValue(q.year);
                    const branch = cleanValue(q.branch);
                    const question_type = cleanValue(q.question_type);

                    if (subject) subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
                    if (topic) topicCounts[topic] = (topicCounts[topic] || 0) + 1;
                    if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
                    if (branch) branchCounts[branch] = (branchCounts[branch] || 0) + 1;
                    if (question_type) questionTypeCounts[question_type] = (questionTypeCounts[question_type] || 0) + 1;

                    if (branch) allBranches.add(branch);
                    if (question_type) allQuestionTypes.add(question_type);

                    if (subject && topic) {
                        if (!subjectTopicMap[subject]) subjectTopicMap[subject] = new Set();
                        subjectTopicMap[subject].add(topic);
                    }
                    if (branch && subject) {
                        if (!branchSubjectMap[branch]) branchSubjectMap[branch] = new Set();
                        branchSubjectMap[branch].add(subject);
                    }
                }
                addLog("✅ Metadata calculated.");

                // --- Part 1.5: Determine Starting qIndex from Metadata ---
                addLog("Fetching existing metadata to determine next available index...");
                const globalMetadataRef = doc(db, "ccat_metadata", "global");
                const globalMetadataSnap = await getDoc(globalMetadataRef);
                let existingData: any = { allQuestionIds: [], subjects: [], topics: [], subjectCounts: {} };
                if (globalMetadataSnap.exists()) {
                    existingData = globalMetadataSnap.data();
                }
                
                let startingQIndex = (existingData.allQuestionIds || []).length;
                addLog(`Found ${startingQIndex} existing questions in metadata. Starting index at ${startingQIndex}.`);

                // --- Part 2: Seed Questions ---
                const targetCollectionName = `ccat_questions`;
                addLog(`Starting database upload to '${targetCollectionName}'...`);

                const questionsCollection = collection(db, targetCollectionName);
                const MAX_WRITES_PER_BATCH = 500;
                let batch = writeBatch(db);
                let count = 0;
                let batchCount = 0;

                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    const docRef = doc(questionsCollection); // Auto-generate ID

                    const subject = q.subject || "General";
                    // Override branch with selected branch to ensure consistency if needed, 
                    // or keep original. usually better to ensure it matches the collection.
                    // But let's respect the JSON if valid, or fallback.
                    const branch = q.branch || selectedBranch;
                    const topic = q.topic || "General";
                    const year = q.year || "N/A";
                    
                    // Automatically append to the last known qIndex
                    const autoIndex = startingQIndex + i + 1;
                    
                    const newLabel = `Question ${autoIndex}`;
                    // Override the title with the auto-generated sequential label to avoid collisions
                    const title = newLabel;

                    const question_images = extractOriginalImageUrls(q.question_images);
                    const explanation_images = extractOriginalImageUrls(q.explanation_images);

                    const correctOptions = (q.options || []).filter(opt => opt.is_correct);
                    let correctAnswerLabel = null;
                    let correctAnswerLabels: string[] = [];

                    if (q.question_type === 'msq') {
                        correctAnswerLabels = correctOptions.map(opt => opt.label || "").filter(Boolean);
                    } else if (q.question_type === 'mcq' && correctOptions.length > 0) {
                        correctAnswerLabel = correctOptions[0].label || null;
                    }

                    const questionData = {
                        scraped_id: q.question_id,
                        title: title,
                        question_html: q.question_html || q.question_text || "",
                        question_image_links: question_images,

                        explanation_html: q.explanation_html || "",
                        explanation_image_links: explanation_images,

                        options: (q.options || []).map(opt => ({
                            label: opt.label || null,
                            text_html: opt.text_html || opt.text || "",
                            is_correct: opt.is_correct || false
                        })),

                        correctAnswerLabel: correctAnswerLabel,
                        correctAnswerLabels: correctAnswerLabels,
                        question_type: q.question_type || "unknown",

                        nat_answer_min: q.nat_answer_min || null,
                        nat_answer_max: q.nat_answer_max || null,

                        year: year,
                        subject: subject,
                        branch: branch,
                        topic: topic,
                        tags: q.tags || [branch, subject, topic].filter(Boolean),
                        createdAt: new Date().toISOString(),

                        verified: false,
                        attempts: 0,
                        accuracy: 0,
                        // Automatically append index to prevent collisions
                        qIndex: autoIndex
                    };

                    batch.set(docRef, questionData);
                    count++;

                    // Track for metadata sorting
                    questionsForSorting.push({ id: docRef.id, title: title });

                    if (count % MAX_WRITES_PER_BATCH === 0) {
                        batchCount++;
                        addLog(`Committing batch ${batchCount} (${count}/${totalQuestionCount})...`);
                        await batch.commit();
                        batch = writeBatch(db);
                        setProgress(Math.round((count / totalQuestionCount) * 90)); // Up to 90% for questions
                    }
                }

                // Commit remaining
                if (count % MAX_WRITES_PER_BATCH !== 0) {
                    batchCount++;
                    addLog(`Committing final batch ${batchCount}...`);
                    await batch.commit();
                }

                addLog(`✅ Seeding complete. ${count} questions uploaded to ${targetCollectionName}.`);
                setProgress(95);

                // --- Part 3: Save Metadata ---
                addLog("Finalizing metadata...");

                // Base metadata structure (assuming we don't have the original 'metadata.json' file)
                // In seed6.js it reads a separate metadata.json file for 'subjects', 'topics', 'years', 'tags'.
                // Since we only have the questions JSON, we must derive these lists from the unique values we found.
                // This is a slight deviation but necessary if the user only uploads one file.
                // OR we can fetch existing metadata first. 
                // For now, I will derive them from the mapped data to ensure self-consistency.

                // We already fetched existing metadata in Part 1.5 (existingData)

                const finalSubjects = Array.from(new Set([...(existingData.subjects || []), ...Object.keys(subjectCounts)])).sort();
                const finalTopics = Array.from(new Set([...(existingData.topics || []), ...Object.keys(topicCounts)])).sort();
                
                const mergedSubjectCounts = { ...(existingData.subjectCounts || {}) };
                for (const [subj, count] of Object.entries(subjectCounts)) {
                    mergedSubjectCounts[subj] = (mergedSubjectCounts[subj] || 0) + count;
                }

                // Sorting for Daily Challenge
                questionsForSorting.sort((a, b) => {
                    const numA = parseInt((a.title || '0').replace(/\D/g, ''), 10);
                    const numB = parseInt((b.title || '0').replace(/\D/g, ''), 10);
                    return numA - numB;
                });
                const sortedQuestionIds = questionsForSorting.map(q => q.id);
                
                const finalAllQuestionIds = Array.from(new Set([...(existingData.allQuestionIds || []), ...sortedQuestionIds]));

                const finalMetadata = {
                    branch: "global",
                    subjects: finalSubjects,
                    topics: finalTopics,
                    years: Object.keys(yearCounts).sort(), // Not strictly merged but okay for now
                    tags: [],

                    branches: Array.from(allBranches).sort(),
                    questionTypes: Array.from(allQuestionTypes).sort(),
                    questionCount: finalAllQuestionIds.length,

                    subjectCounts: mergedSubjectCounts,
                    topicCounts,
                    yearCounts,
                    branchCounts,
                    questionTypeCounts,

                    subjectTopicMap: convertMapOfSetsToSortedArrays(subjectTopicMap),
                    branchSubjectMap: convertMapOfSetsToSortedArrays(branchSubjectMap),

                    allQuestionIds: finalAllQuestionIds,
                    lastUpdated: new Date().toISOString()
                };

                // Write to global metadata document
                await setDoc(globalMetadataRef, finalMetadata, { merge: true });

                addLog("✅ Metadata document updated successfully.");
                addLog("🎉 All Done!");
                setProgress(100);

                if (onSuccess) onSuccess();
                // Close after a short delay or let user close
                // setTimeout(onClose, 2000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred during import.");
            addLog(`❌ Error: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileJson className="w-5 h-5 text-blue-500" />
                        Import Question Data
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">

                    {!isUploading && progress === 0 && (
                        <div className="space-y-4">
                            {/* Branch Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Select Target Branch
                                </label>
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="" disabled>Select a branch...</option>
                                    {branches.map(branch => (
                                        <option key={branch} value={branch}>{branch}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".json"
                                    onChange={handleFileChange}
                                />
                                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {file ? file.name : "Click to select a JSON file"}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Must be a valid array of questions structure
                                </p>
                            </div>

                            {parsedQuestions && (
                                <div className="space-y-4 border border-gray-200 dark:border-zinc-800 rounded-lg p-4 bg-gray-50 dark:bg-zinc-900/50">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-800 pb-2">
                                        Bulk Edit ({parsedQuestions.length} Questions)
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Apply Subject</label>
                                            <input
                                                type="text"
                                                value={bulkSubject}
                                                onChange={(e) => setBulkSubject(e.target.value)}
                                                placeholder="e.g. Machine Learning"
                                                className="w-full px-3 py-1.5 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Apply Topic</label>
                                            <input
                                                type="text"
                                                value={bulkTopic}
                                                onChange={(e) => setBulkTopic(e.target.value)}
                                                placeholder="e.g. Neural Networks"
                                                className="w-full px-3 py-1.5 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Apply Tags (comma sep)</label>
                                            <input
                                                type="text"
                                                value={bulkTags}
                                                onChange={(e) => setBulkTags(e.target.value)}
                                                placeholder="e.g. bda, ml, nn"
                                                className="w-full px-3 py-1.5 border border-gray-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setParsedQuestions(prev => {
                                                if (!prev) return prev;
                                                return prev.map(q => ({
                                                    ...q,
                                                    subject: bulkSubject || q.subject,
                                                    topic: bulkTopic || q.topic,
                                                    tags: bulkTags ? bulkTags.split(',').map(t => t.trim()).filter(Boolean) : q.tags
                                                }));
                                            });
                                            addLog(`Applied bulk edits to ${parsedQuestions.length} questions.`);
                                        }}
                                        className="w-full py-2 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded transition-colors"
                                    >
                                        Apply to All Questions
                                    </button>
                                </div>
                            )}

                            {file && parsedQuestions && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleImport}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
                                    >
                                        Confirm & Import {parsedQuestions.length} Questions
                                    </button>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-start gap-2 text-sm">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {(isUploading || progress > 0) && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                                <span>Progress</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>

                            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto space-y-1 shadow-inner">
                                {logs.length === 0 && <span className="text-gray-500">Initializing...</span>}
                                {logs.map((log, idx) => (
                                    <div key={idx}>{log}</div>
                                ))}
                                {isUploading && (
                                    <div className="flex items-center gap-2 text-blue-400 mt-2">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Processing...</span>
                                    </div>
                                )}
                                {progress === 100 && (
                                    <div className="flex items-center gap-2 text-green-400 mt-2 font-bold">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Import Successful!</span>
                                    </div>
                                )}
                            </div>

                            {progress === 100 && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={onClose}
                                        className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
