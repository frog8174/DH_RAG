import React, { useState, useEffect } from 'react';
import { Check, X, ArrowLeft, Send, RotateCcw, BookOpen } from 'lucide-react';

type Question = {
    題幹: string;
    選項A: string;
    選項B: string;
    選項C: string;
    選項D: string;
    正確答案: string;
    解析: string;
};

type Props = {
    questions: Question[];
    onExit: () => void;
};

const ExamView: React.FC<Props> = ({ questions, onExit }) => {
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleSelectOption = (qIdx: number, optionLabel: string) => {
        if (submitted) return;
        setUserAnswers(prev => ({ ...prev, [qIdx]: optionLabel }));
    };

    const handleSubmit = () => {
        if (!confirm("確定要交卷嗎？")) return;
        
        let correctCount = 0;
        questions.forEach((q, idx) => {
            // Extract correct label from string like "(A)" or "A"
            const correctLabel = q["正確答案"].match(/[A-D]/)?.[0] || "";
            if (userAnswers[idx] === correctLabel) {
                correctCount++;
            }
        });
        
        setScore(Math.round((correctCount / questions.length) * 100));
        setSubmitted(true);
        window.scrollTo(0, 0);
    };

    const handleRetry = () => {
        if (!confirm("確定要重測嗎？將清除所有答案。")) return;
        setUserAnswers({});
        setSubmitted(false);
        setScore(0);
        window.scrollTo(0, 0);
    };

    if (questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
                <p className="text-slate-500 mb-4">試卷中沒有題目</p>
                <button onClick={onExit} className="text-blue-600 hover:underline">返回出題</button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors">
                        <ArrowLeft size={20} />
                        <span className="font-bold">離開測驗</span>
                    </button>
                    <div className="h-6 w-px bg-slate-300"></div>
                    <h1 className="text-xl font-bold text-slate-800">線上模擬測驗</h1>
                </div>
                {submitted && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-500">得分</span>
                        <span className={`text-3xl font-black ${score >= 60 ? "text-green-600" : "text-red-500"}`}>
                            {score}
                        </span>
                    </div>
                )}
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
                <div className="max-w-3xl mx-auto space-y-8">
                    {questions.map((q, idx) => {
                        const correctLabel = q["正確答案"].match(/[A-D]/)?.[0] || "";
                        const userAnswer = userAnswers[idx];
                        const isCorrect = userAnswer === correctLabel;
                        
                        return (
                            <div key={idx} id={`q-${idx}`} className={`bg-white rounded-2xl shadow-sm border p-6 transition-all ${submitted ? (isCorrect ? "border-green-200 ring-1 ring-green-100" : "border-red-200 ring-1 ring-red-100") : "border-slate-200"}`}>
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0">
                                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-sm">
                                            {idx + 1}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-lg font-medium text-slate-800 mb-6 leading-relaxed">
                                            {q["題幹"]}
                                        </div>

                                        <div className="space-y-3">
                                            {["A", "B", "C", "D"].map((optLabel) => {
                                                const optText = q[`選項${optLabel}` as keyof Question];
                                                const isSelected = userAnswer === optLabel;
                                                const isThisCorrect = correctLabel === optLabel;
                                                
                                                let optionClass = "border-slate-200 hover:bg-slate-50";
                                                if (submitted) {
                                                    if (isThisCorrect) optionClass = "border-green-500 bg-green-50 text-green-800 font-medium";
                                                    else if (isSelected && !isThisCorrect) optionClass = "border-red-500 bg-red-50 text-red-800";
                                                    else optionClass = "border-slate-100 opacity-50";
                                                } else {
                                                    if (isSelected) optionClass = "border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500";
                                                }

                                                return (
                                                    <button
                                                        key={optLabel}
                                                        onClick={() => handleSelectOption(idx, optLabel)}
                                                        disabled={submitted}
                                                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 ${optionClass}`}
                                                    >
                                                        <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                                                            submitted 
                                                                ? (isThisCorrect ? "border-green-500 bg-green-500 text-white" : (isSelected ? "border-red-500 bg-red-500 text-white" : "border-slate-300"))
                                                                : (isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-400")
                                                        }`}>
                                                            {optLabel}
                                                        </span>
                                                        <span className="text-sm">{optText}</span>
                                                        {submitted && isThisCorrect && <Check size={20} className="ml-auto text-green-600" />}
                                                        {submitted && isSelected && !isThisCorrect && <X size={20} className="ml-auto text-red-500" />}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Explanation (Only after submit) */}
                                        {submitted && (
                                            <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                                                    <BookOpen size={16} className="text-blue-500"/>
                                                    解析
                                                </div>
                                                <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl whitespace-pre-wrap">
                                                    {q["解析"]}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Action */}
            <div className="bg-white border-t border-slate-200 p-4 flex justify-center items-center gap-4 shadow-lg z-30 flex-shrink-0">
                {!submitted ? (
                    <button 
                        onClick={handleSubmit}
                        disabled={Object.keys(userAnswers).length === 0}
                        className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold text-white shadow-lg transition-all transform active:scale-95 ${Object.keys(userAnswers).length === 0 ? "bg-slate-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1"}`}
                    >
                        <Send size={18} /> 交卷 ({Object.keys(userAnswers).length}/{questions.length})
                    </button>
                ) : (
                    <button 
                        onClick={handleRetry}
                        className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 shadow-md transition-all"
                    >
                        <RotateCcw size={18} /> 重新測驗
                    </button>
                )}
            </div>
        </div>
    );
};

export default ExamView;
