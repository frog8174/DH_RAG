import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, FileText, Settings, Users, Activity,
  TrendingUp, BookOpen, Clock, AlertCircle, Search,
  Plus, Trash2, Download, Play, ChevronDown, ChevronRight,
  Check, X, Sparkles, Filter, Layers, Database, Brain, PenTool
} from 'lucide-react';
import * as XLSX from 'xlsx'; // Add this import
import AdminDashboard from "./AdminDashboard";
import ExamView from "./ExamView";

// --- Types ---

type ConfigResponse = {
  models: string[];
  default_model: string;
  default_top_k: number;
  max_top_k: number;
  response_schema?: any;
  prompt_templates?: Record<string, string>;
  cognitive_levels?: Record<string, string>;
};

type OptionsResponse = {
  source_types: string[];
  subjects: string[];
  topics: string[];
};

type RetrievedDoc = {
  metadata: Record<string, any>;
  snippet: string;
};

type RagResponse = {
  ok: boolean;
  model: string;
  top_k: number;
  query: string;
  output?: any | null; // Legacy
  generated_questions?: any[]; // New List
  raw_text?: string | null;
  refined_prompt?: string | null;
  debug: {
    prompt?: string;
    retrieved_docs?: RetrievedDoc[];
    cognitive_level_applied?: string;
    review_log?: any[];
  };
  log_id?: number;
  params?: any;
};

type LogEntry = {
  id: number;
  timestamp: string;
  query: string;
  params: any;
  prompt: string;
  refined_prompt?: string;
  response: any;
  raw_output: string | null;
  rating?: number;
  comment?: string;
  username?: string;
};

type ActiveTab = "output" | "json" | "docs" | "prompt" | "refined";

type User = {
    username: string;
    role: "user" | "admin";
};

type Question = {
    題幹: string;
    選項A: string;
    選項B: string;
    選項C: string;
    選項D: string;
    正確答案: string;
    解析: string;
};

// --- Helper Components ---

const BatchResult: React.FC<{
    result: RagResponse;
    batchIndex: number;
    totalBatches: number;
    examPaper: Question[];
    onAddToExam: (q: Question) => void;
}> = ({ result, batchIndex, totalBatches, examPaper, onAddToExam }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>("output");

    // Extract unique references from retrieved docs
    const references = Array.from(new Set(result.debug.retrieved_docs?.map(d => d.metadata.reference || d.metadata.title || "reference not found") || ["reference not found"]));

    const renderQuestionCard = (q: any, idx: number) => {
        if (!q || typeof q !== "object") return null;
        if (q.error || q.raw_error) return <div key={idx} className="text-red-500 border p-2 rounded mb-2 text-xs">Error: {q.error || q.raw_error}</div>;
        
        const question = q["題幹"];
        const optionsRaw = [q["選項A"], q["選項B"], q["選項C"], q["選項D"]].filter(v => typeof v === "string" && v.length > 0);
        const answerRaw = q["正確答案"];
        const explanation = q["解析"];
        
        let answerLabel: string | null = null;
        if (typeof answerRaw === "string") {
          const m = answerRaw.match(/\(([A-D])\)/);
          if (m) answerLabel = m[1];
        }
  
        const isAdded = examPaper.some(existing => existing["題幹"] === question);
  
        return (
          <div key={idx} className={`group bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-4 transition-all hover:shadow-md ${isAdded ? "ring-2 ring-blue-50 bg-blue-50/20" : ""}`}>
            <div className="flex justify-between items-start mb-3">
               <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">#{idx + 1}</span>
               <button 
                  onClick={() => onAddToExam(q as Question)}
                  disabled={isAdded}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${isAdded 
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow"}`}
               >
                  {isAdded ? <Check size={12}/> : <Plus size={12}/>}
                  {isAdded ? "已加入" : "新增試題"}
               </button>
            </div>
            <div className="text-sm font-medium text-slate-800 mb-4 whitespace-pre-wrap leading-relaxed">{question}</div>
            <div className="space-y-2 mb-4">
                {optionsRaw.map((opt, oIdx) => {
                  const label = String.fromCharCode(65 + oIdx);
                  const isCorrect = (answerLabel && answerLabel.toUpperCase() === label.toUpperCase()) || (typeof answerRaw === "string" && answerRaw.trim() === opt.trim());
                  return (
                    <div key={oIdx} className={`flex items-start p-2 rounded-lg text-sm transition-colors ${isCorrect ? "bg-green-50 text-green-800 border border-green-100" : "bg-slate-50 text-slate-600 border border-slate-100"}`}>
                      <span className={`mr-3 font-mono font-bold ${isCorrect ? "text-green-600" : "text-slate-400"}`}>{label}.</span>
                      <span>{opt}</span>
                    </div>
                  );
                })}
            </div>
            {explanation && (
               <details className="text-xs group/details">
                   <summary className="cursor-pointer text-slate-400 hover:text-blue-600 list-none flex items-center gap-2 select-none">
                       <ChevronRight size={14} className="group-open/details:rotate-90 transition-transform" />
                       <span className="font-medium">顯示解析與出處</span>
                   </summary>
                   <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                       <div>
                           <div className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                               <Check size={14} className="text-green-500"/> 正確答案：{answerRaw}
                           </div>
                           <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">{explanation}</div>
                       </div>
                       {references.length > 0 && (
                           <div className="pt-3 border-t border-slate-200">
                               <div className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                                   <BookOpen size={14} className="text-blue-500"/> 參考資料
                               </div>
                               <ul className="space-y-1">
                                   {references.map((ref, i) => (
                                       <li key={i} className="flex items-start gap-2 text-slate-500">
                                           <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 flex-shrink-0"></span>
                                           <span>{ref}</span>
                                       </li>
                                   ))}
                               </ul>
                           </div>
                       )}
                   </div>
               </details>
            )}
          </div>
        );
    };

    return (
        <div className="mb-8 last:mb-20 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Batch Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-xs shadow-sm">
                        #{totalBatches - batchIndex}
                    </div>
                    <div>
                        <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                            <span>{new Date().toLocaleTimeString()}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span>{result.model}</span>
                            {result.params?.enable_self_reflection && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold text-[10px]">
                                        <Sparkles size={10} /> Review
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="text-sm font-bold text-slate-800 line-clamp-1 max-w-xs" title={result.query}>
                            {result.query}
                        </div>
                    </div>
                </div>
                
                {/* Debug Tools Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(["output", "prompt", "docs"] as ActiveTab[]).map(t => (
                        <button 
                            key={t} 
                            onClick={() => setActiveTab(activeTab === t ? "output" : t)} 
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === t 
                                ? "bg-white text-blue-600 shadow-sm" 
                                : "text-slate-400 hover:text-slate-600"}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            {activeTab === "output" ? (
                <div className="space-y-4">
                    {result.generated_questions && result.generated_questions.length > 0 ? (
                        result.generated_questions.map((q, idx) => renderQuestionCard(q, idx))
                    ) : (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-400 text-sm">未能生成有效題目</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-slate-900 rounded-xl p-4 overflow-auto max-h-96 shadow-inner">
                    <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                        {activeTab === "prompt" && result.debug.prompt}
                        {activeTab === "docs" && JSON.stringify(result.debug.retrieved_docs, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};


// --- App Component ---

const App: React.FC = () => {
  // --- State: Auth ---
  const [user, setUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- State: App Config ---
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // --- State: View ---
  const [view, setView] = useState<"generator" | "admin" | "exam">("generator");
  const [adminView, setAdminView] = useState<"dashboard" | "users" | "prompts" | "logs">("dashboard");

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]); 
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  const [expandedLog, setExpandedLog] = useState<LogEntry | null>(null);

  // --- State: Admin Prompt Editor ---
  const [editingPromptMode, setEditingPromptMode] = useState<string>("");
  const [editingPromptContent, setEditingPromptContent] = useState<string>("");
  const [promptSaveStatus, setPromptSaveStatus] = useState("");

  // --- State: Generator Params ---
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [validateStatus, setValidateStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [validateMsg, setValidateMsg] = useState("");

  const [model, setModel] = useState("gemini-2.0-flash"); 
  const [topK, setTopK] = useState(5);
  const [mode, setMode] = useState("question_generation");
  const [selectedSources, setSelectedSources] = useState<string[]>([]); 
  
  // NEW Fields
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]); 
  const [subjectInput, setSubjectInput] = useState(""); 
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]); // NEW: Multi-select topics
  const [topicInput, setTopicInput] = useState("");     
  const [genCount, setGenCount] = useState<number>(1);
  const [selectedCognitiveLevels, setSelectedCognitiveLevels] = useState<string[]>([]);
  
  // Advanced Params
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState<number | "">("");
  const [thinkingBudget, setThinkingBudget] = useState<number | "">("");
  const [useQueryRewriting, setUseQueryRewriting] = useState(false);
  const [rewriteTemperature, setRewriteTemperature] = useState<number>(0.7);
  const [enableSelfReflection, setEnableSelfReflection] = useState(false); // New

  // --- State: Execution ---
  const [query, setQuery] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [results, setResults] = useState<RagResponse[]>([]);

  // --- State: Exam Paper ---
  const [examPaper, setExamPaper] = useState<Question[]>([]);


  // --- Effects ---

  useEffect(() => {
    const init = async () => {
      try {
        setConfigLoading(true);
        setConfigError(null);

        const resConfig = await fetch("/api/config");
        if (!resConfig.ok) throw new Error("Failed to fetch config");
        const dataConfig: ConfigResponse = await resConfig.json();
        setConfig(dataConfig);
        setTopK(dataConfig.default_top_k);

        const resOptions = await fetch("/api/options");
        if (resOptions.ok) {
            const dataOptions: OptionsResponse = await resOptions.json();
            setOptions(dataOptions);
            if (dataOptions.source_types) setSelectedSources(dataOptions.source_types);
        }
      } catch (e: any) {
        console.error(e);
        setConfigError("無法取得後端設定，請確認 server 是否有啟動。");
      } finally {
        setConfigLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
      if (view === "admin" && config?.prompt_templates) {
          if (!editingPromptMode && Object.keys(config.prompt_templates).length > 0) {
              const firstMode = Object.keys(config.prompt_templates)[0];
              setEditingPromptMode(firstMode);
              setEditingPromptContent(config.prompt_templates[firstMode]);
          }
      }
  }, [view, config]);

  useEffect(() => {
      if (view === "admin") {
          fetchLogs();
          if (user?.role === 'admin') fetchUsers();
      }
  }, [view]);


  // --- Handlers (Keep original logic) ---

  const fetchUsers = async () => {
      try {
          const res = await fetch("/api/users");
          if(res.ok) setUsersList(await res.json());
      } catch(e) { console.error(e); }
  };

  const handleAddUser = async () => {
      if(!newUser.username || !newUser.password) return alert("請輸入帳號密碼");
      try {
          const res = await fetch("/api/users", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify(newUser)
          });
          if(res.ok) {
              alert("新增成功");
              setNewUser({ username: "", password: "", role: "user" });
              fetchUsers();
          } else {
              alert("新增失敗 (帳號可能重複)");
          }
      } catch(e) { alert("Error"); }
  };

  const handleDeleteUser = async (username: string) => {
      if(!confirm(`確定刪除使用者 ${username}?`)) return;
      try {
          const res = await fetch(`/api/users/${username}`, { method: "DELETE" });
          if(res.ok) fetchUsers();
          else alert("刪除失敗");
      } catch(e) { alert("Error"); }
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const res = await fetch("/api/login", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({username: usernameInput, password: passwordInput})
          });
          if (res.ok) {
              const data = await res.json();
              setUser(data.user);
              setLoginError("");
          } else {
              setLoginError("登入失敗，請檢查帳號密碼 (預設 admin/admin, user/user)");
          }
      } catch (err) {
          setLoginError("連線錯誤");
      }
  };

  const handleValidate = async () => {
      if (!apiKey) {
          setValidateStatus("error");
          setValidateMsg("請輸入 API Key");
          return;
      }
      setValidateStatus("checking");
      setValidateMsg("");
      try {
          const res = await fetch("/api/validate-gemini", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ api_key: apiKey, model: model || config?.default_model })
          });
          const data = await res.json();
          if (data.ok) {
              setValidateStatus("ok");
              setValidateMsg("連線成功");
          } else {
              setValidateStatus("error");
              setValidateMsg("連線失敗: " + data.error);
          }
      } catch (e: any) {
          setValidateStatus("error");
          setValidateMsg("連線錯誤: " + e.message);
      }
  };

  const handleRun = async () => {
    if (!apiKey) {
        setError("請先輸入 Gemini API Key");
        return;
    }
    setError(null);
    setLoading(true);

    try {
      const combinedSubjects = [...selectedSubjects];
      if (subjectInput.trim()) combinedSubjects.push(subjectInput.trim());
      const subjectStr = combinedSubjects.join("、");

      const combinedTopics = [...selectedTopics];
      if (topicInput.trim()) combinedTopics.push(topicInput.trim());
      const topicStr = combinedTopics.join("、");

      const body = {
        query: query.trim() || "無補充要求",
        api_key: apiKey.trim(),
        model: model || null,
        top_k: topK,
        mode,
        source_types: selectedSources.length > 0 ? selectedSources : null,
        subject: subjectStr || null,
        topic: topicStr || null,
        count: genCount,
        cognitive_level: selectedCognitiveLevels.length > 0 ? selectedCognitiveLevels : null,
        temperature: temperature === "" ? null : Number(temperature),
        thinking_budget: thinkingBudget === "" ? null : Number(thinkingBudget),
        use_query_rewriting: useQueryRewriting,
        rewrite_temperature: useQueryRewriting ? rewriteTemperature : null,
        enable_self_reflection: enableSelfReflection, // New
        username: user ? user.username : "anonymous" 
      };
      
      const res = await fetch("/api/rag/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        let responseBodyText = "";
        try {
            responseBodyText = await res.text(); // Read body ONCE as text
            const errData = JSON.parse(responseBodyText); // Try to parse as JSON
            if (errData.detail) errorMsg = errData.detail;
            else if (errData.error) errorMsg = errData.error; // Check for a general 'error' field too
            else if (responseBodyText) errorMsg = responseBodyText; // Fallback to full text if JSON parsing worked but no specific error field
        } catch {
            // If JSON parsing failed, use the raw text directly
            if (responseBodyText) errorMsg = responseBodyText;
        }
        throw new Error(errorMsg);
      }

      const data: RagResponse = await res.json();
      setResults(prev => [{...data, params: body}, ...prev]);
      
    } catch (e: any) {
      console.error(e);
      setError(e.message || "呼叫 /api/rag/generate 發生錯誤");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrompt = async () => {
      try {
          setPromptSaveStatus("Saving...");
          const res = await fetch("/api/config/update_prompt", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({
                  mode: editingPromptMode,
                  template: editingPromptContent
              })
          });
          if (res.ok) {
              setPromptSaveStatus("Saved!");
              if (config && config.prompt_templates) {
                  setConfig({
                      ...config,
                      prompt_templates: {
                          ...config.prompt_templates,
                          [editingPromptMode]: editingPromptContent
                      }
                  });
              }
              setTimeout(() => setPromptSaveStatus(""), 2000);
          } else {
              setPromptSaveStatus("Error saving.");
          }
      } catch (e) {
          setPromptSaveStatus("Error saving.");
      }
  };

  const fetchLogs = async () => {
      if (!user) return;
      try {
          const queryParams = new URLSearchParams({
              limit: "50",
              username: user.username,
              role: user.role
          });
          const res = await fetch(`/api/logs?${queryParams.toString()}`);
          if (res.ok) {
              const data = await res.json();
              setLogs(data);
          }
      } catch (e) { console.error(e); }
  };

  const handleExportAll = async (type: "json" | "csv") => {
      try {
          const res = await fetch("/api/logs?limit=10000");
          if(!res.ok) throw new Error("Failed");
          const allLogs: LogEntry[] = await res.json();
          const filename = `rag_logs_all_${Date.now()}.${type}`;
          
          let content = "";
          if(type === "json") {
              content = JSON.stringify(allLogs, null, 2);
          } else {
              const headers = ["id", "timestamp", "query", "model", "rating", "comment", "prompt", "response"];
              content = [
                  headers.join(","),
                  ...allLogs.map(log => [
                      log.id,
                      `"${log.timestamp}"`,
                      `"${String(log.query).replace(/"/g, '""')}"`,
                      `"${log.params?.model}"`,
                      log.rating || "",
                      `"${String(log.comment||"").replace(/"/g, '""')}"`,
                      `"${String(log.prompt||"").replace(/"/g, '""')}"`,
                      `"${String(log.raw_output||"").replace(/"/g, '""')}"`
                  ].join(','))
              ].join("\n");
          }
          
          const blob = new Blob([content], { type: type === "json" ? "application/json" : "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch(e) { alert("Export failed"); }
  };

  const handleExportSingle = (log: LogEntry, type: "json" | "csv") => {
      const filename = `rag_log_${log.id}.${type}`;
      let content = "";
      if (type === "json") {
          content = JSON.stringify(log, null, 2);
      } else {
          const headers = ["id", "timestamp", "query", "model", "rating", "comment", "prompt", "response"];
          content = [
              headers.join(","),
              [
                  log.id,
                  `"${log.timestamp}"`,
                  `"${String(log.query).replace(/"/g, '""')}"`,
                  `"${log.params?.model}"`,
                  log.rating || "",
                  `"${String(log.comment||"").replace(/"/g, '""')}"`,
                  `"${String(log.prompt||"").replace(/"/g, '""')}"`,
                  `"${String(log.raw_output||"").replace(/"/g, '""')}"`
              ].join(",")
          ].join("\n");
      }
      const blob = new Blob([content], { type: type === "json" ? "application/json" : "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDeleteLog = async (id: number) => {
      if (!confirm("確定要刪除此筆紀錄嗎？")) return;
      try {
          const res = await fetch(`/api/logs/${id}`, { method: "DELETE" });
          if (res.ok) {
              setLogs(logs.filter(l => l.id !== id));
              if (expandedLog?.id === id) setExpandedLog(null);
          } else {
              alert("刪除失敗");
          }
      } catch(e) { alert("刪除錯誤"); }
  };

  const addToExamPaper = (question: Question) => {
      if (examPaper.some(q => q["題幹"] === question["題幹"])) {
          alert("此題目已在考卷中");
          return;
      }
      setExamPaper([...examPaper, question]);
  };

  const removeFromExamPaper = (index: number) => {
      setExamPaper(examPaper.filter((_, i) => i !== index));
  };
  
  const handleExportExamPaperCSV = () => {
      if (examPaper.length === 0) return;
      
      const headers = ["題幹", "選項A", "選項B", "選項C", "選項D", "正確答案", "解析"];
      const rows = examPaper.map(q => [
          q["題幹"],
          q["選項A"],
          q["選項B"],
          q["選項C"],
          q["選項D"],
          q["正確答案"],
          q["解析"]
      ].map(field => `"${String(field).replace(/"/g, '""')}"`));
      
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      // Add BOM for Excel UTF-8 compatibility
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `exam_paper_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleExportExamPaperExcel = () => {
      if (examPaper.length === 0) return;

      const worksheet = XLSX.utils.json_to_sheet(examPaper);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Exam Paper");
      XLSX.writeFile(workbook, `exam_paper_${Date.now()}.xlsx`);
  };

  const renderQuestionCardPreview = (q: Question, idx: number) => {
      return (
        <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 group relative hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
             <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">#{idx + 1}</span>
             <button 
                onClick={() => removeFromExamPaper(idx)}
                className="opacity-0 group-hover:opacity-100 text-xs bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100 transition-all flex items-center gap-1"
             >
                <Trash2 size={12}/> 移除
             </button>
          </div>
          <div className="text-sm font-medium text-slate-800 mb-3 whitespace-pre-wrap">{q["題幹"]}</div>
          <div className="text-xs text-slate-500 space-y-1 pl-1 border-l-2 border-slate-100">
              <div className="flex gap-2"><span>A.</span><span>{q["選項A"]}</span></div>
              <div className="flex gap-2"><span>B.</span><span>{q["選項B"]}</span></div>
              <div className="flex gap-2"><span>C.</span><span>{q["選項C"]}</span></div>
              <div className="flex gap-2"><span>D.</span><span>{q["選項D"]}</span></div>
          </div>
        </div>
      );
  };


  // --- Render Login ---
  if (!user) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                  <div className="text-center mb-8">
                      <div className="inline-flex p-3 bg-blue-50 rounded-2xl mb-4 text-blue-600">
                          <Activity size={32} />
                      </div>
                      <h1 className="text-2xl font-bold text-slate-800">登入系統</h1>
                      <span className="text-xs text-slate-400 font-mono mt-2 block">Version 0.8.0 (Unified UI)</span>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
                          <input type="text" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" required />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                          <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" required />
                      </div>
                      {loginError && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{loginError}</div>}
                      <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all">登入</button>
                  </form>
              </div>
          </div>
      );
  }

  // --- Render Main App ---
  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      {view === "generator" && (
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md">
                    <Brain size={18} />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-slate-800 leading-none">History RAG</h1>
                    <span className="text-[10px] text-slate-400 font-medium tracking-wide">AI QUESTION GENERATOR</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    {user.username}
                </div>
                {user.role === "admin" && (
                    <button 
                        onClick={() => setView("admin")}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                        <LayoutDashboard size={16} /> 後台管理
                    </button>
                )}
                <button onClick={() => setUser(null)} className="text-sm text-slate-400 hover:text-red-500 transition-colors px-2">登出</button>
            </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden"> 
        {view === "generator" ? (
            <div className="h-full flex flex-col md:flex-row divide-x divide-slate-200">
                
                {/* 1. LEFT COLUMN: CONTROLS */}
                <div className="w-full md:w-1/4 min-w-[320px] overflow-y-auto bg-white p-5 border-r border-slate-200 scrollbar-thin">
                    <div className="space-y-6 pb-24">
                        <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-3">
                            <Settings size={18} className="text-blue-600" />
                            <h2 className="text-sm font-bold uppercase tracking-wider">出題參數配置</h2>
                        </div>
                        
                        {/* API Key */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gemini API Key</label>
                            <div className="relative">
                                <input 
                                    type={showApiKey ? "text" : "password"} 
                                    value={apiKey} 
                                    onChange={e => setApiKey(e.target.value)} 
                                    className={`w-full pl-3 pr-10 py-2.5 rounded-lg border text-sm outline-none transition-all ${validateStatus === "error" ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300"}`}
                                    placeholder="Paste API Key" 
                                />
                                <button 
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-medium"
                                >
                                    {showApiKey ? "HIDE" : "SHOW"}
                                </button>
                            </div>
                            <div className="flex justify-end">
                                <button 
                                    onClick={handleValidate} 
                                    className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${validateStatus === "ok" ? "text-green-600" : "text-blue-600 hover:underline"}`}
                                >
                                    {validateStatus === "checking" ? <span className="animate-pulse">Checking...</span> : validateStatus === "ok" ? "Connected" : "Test Connection"}
                                </button>
                            </div>
                        </div>

                        {/* Model & Params Group */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-4">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2">
                                    <Activity size={14}/> 模型選擇
                                </label>
                                <select 
                                    value={model} 
                                    onChange={e => setModel(e.target.value)} 
                                    className="w-full rounded-lg border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Temp</label>
                                    <input type="number" step="0.1" min="0" max="2" value={temperature} onChange={e => setTemperature(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="Default"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Budget</label>
                                    <input type="number" step="100" min="0" value={thinkingBudget} onChange={e => setThinkingBudget(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="Default"/>
                                </div>
                            </div>
                        </div>
                        
                        {/* Filters Group */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-2 pt-2">
                                <Filter size={16} className="text-blue-600" />
                                <h3 className="text-xs font-bold uppercase tracking-wider">內容篩選</h3>
                            </div>

                            {/* Top-K Control */}
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                         <Database size={12}/> 檢索資料庫筆數 (Top-K)
                                    </label>
                                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{topK}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    step="1" 
                                    value={topK} 
                                    onChange={e => setTopK(Number(e.target.value))} 
                                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-100">
                                    <AlertCircle size={10} className="mt-0.5 shrink-0"/>
                                    <span>注意：大量檢索可能造成 Token 用量高</span>
                                </div>
                            </div>

                            {/* Source */}
                            <details className="group rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors select-none">
                                    <div className="flex items-center gap-2">
                                        <Database size={14} className="text-slate-400"/>
                                        <span>資料來源</span>
                                        {selectedSources.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{selectedSources.length}</span>}
                                    </div>
                                    <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180"/>
                                </summary>
                                <div className="border-t border-slate-100 p-3 bg-slate-50/50">
                                    <div className="h-24 overflow-y-auto space-y-1 custom-scrollbar">
                                        {options?.source_types.map(s => (
                                            <label key={s} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm cursor-pointer transition-all">
                                                <input type="checkbox" checked={selectedSources.includes(s)} onChange={e => {
                                                    if(e.target.checked) setSelectedSources([...selectedSources, s]);
                                                    else setSelectedSources(selectedSources.filter(x => x !== s));
                                                }} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300" />
                                                <span className="text-sm text-slate-600">{s}</span>
                                            </label>
                                        )) || <div className="text-xs text-slate-400 italic">Loading sources...</div>}
                                    </div>
                                </div>
                            </details>

                            {/* Subject */}
                            <details className="group rounded-xl border border-slate-200 bg-white overflow-hidden" open>
                                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors select-none">
                                    <div className="flex items-center gap-2">
                                        <BookOpen size={14} className="text-slate-400"/>
                                        <span>主題類別</span>
                                        {selectedSubjects.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{selectedSubjects.length}</span>}
                                    </div>
                                    <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180"/>
                                </summary>
                                <div className="border-t border-slate-100 p-3 bg-slate-50/50">
                                    <div className="max-h-32 overflow-y-auto space-y-1 mb-3 custom-scrollbar">
                                        {options?.subjects.map(s => (
                                            <label key={s} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm cursor-pointer transition-all">
                                                <input type="checkbox" checked={selectedSubjects.includes(s)} onChange={e => {
                                                    if(e.target.checked) setSelectedSubjects([...selectedSubjects, s]);
                                                    else setSelectedSubjects(selectedSubjects.filter(x => x !== s));
                                                }} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300" />
                                                <span className="text-sm text-slate-600">{s}</span>
                                            </label>
                                        )) || <div className="text-xs text-slate-400 italic">Loading...</div>}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={subjectInput} 
                                        onChange={e => setSubjectInput(e.target.value)} 
                                        placeholder="+ 自訂其他主題..." 
                                        className="w-full rounded-lg border-slate-200 px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                </div>
                            </details>

                            {/* Topic (Multi-select) */}
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2">
                                    <Layers size={14}/> 詳細主題 (Topic)
                                </label>
                                
                                {/* Selected Chips */}
                                {selectedTopics.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {selectedTopics.map(t => (
                                            <span key={t} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                                                {t}
                                                <button onClick={() => setSelectedTopics(selectedTopics.filter(x => x !== t))} className="hover:text-blue-900"><X size={10}/></button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Input */}
                                <div className="flex gap-1 mb-2">
                                    <input 
                                        type="text" 
                                        value={topicInput} 
                                        onChange={e => setTopicInput(e.target.value)} 
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && topicInput.trim()) {
                                                e.preventDefault();
                                                if (!selectedTopics.includes(topicInput.trim())) {
                                                    setSelectedTopics([...selectedTopics, topicInput.trim()]);
                                                    setTopicInput("");
                                                }
                                            }
                                        }}
                                        placeholder="輸入並按 Enter 新增..." 
                                        className="w-full rounded-lg border-slate-200 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                                    />
                                    {topicInput.trim() && (
                                        <button 
                                            onClick={() => {
                                               if (!selectedTopics.includes(topicInput.trim())) {
                                                    setSelectedTopics([...selectedTopics, topicInput.trim()]);
                                                    setTopicInput("");
                                                }
                                            }}
                                            className="bg-blue-600 text-white px-3 rounded-lg hover:bg-blue-700"
                                        >
                                            <Plus size={16}/>
                                        </button>
                                    )}
                                </div>

                                {/* Suggestions */}
                                <div className="flex flex-wrap gap-1.5 mt-2 max-h-20 overflow-y-auto custom-scrollbar">
                                    {options?.topics?.slice(0, 15).map(t => (
                                        <button 
                                            key={t} 
                                            onClick={() => {
                                                if (selectedTopics.includes(t)) {
                                                    setSelectedTopics(selectedTopics.filter(x => x !== t));
                                                } else {
                                                    setSelectedTopics([...selectedTopics, t]);
                                                }
                                            }} 
                                            className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors shadow-sm ${selectedTopics.includes(t) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600"}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cognitive Level */}
                            <details className="group rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors select-none">
                                    <div className="flex items-center gap-2">
                                        <Brain size={14} className="text-slate-400"/>
                                        <span>認知層次</span>
                                        {selectedCognitiveLevels.length > 0 && <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full">{selectedCognitiveLevels.length}</span>}
                                    </div>
                                    <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180"/>
                                </summary>
                                <div className="border-t border-slate-100 p-3 bg-slate-50/50">
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {config?.cognitive_levels ? Object.keys(config.cognitive_levels).map(lvl => (
                                            <label key={lvl} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm cursor-pointer transition-all">
                                                <input type="checkbox" checked={selectedCognitiveLevels.includes(lvl)} onChange={e => {
                                                    if(e.target.checked) setSelectedCognitiveLevels([...selectedCognitiveLevels, lvl]);
                                                    else setSelectedCognitiveLevels(selectedCognitiveLevels.filter(x => x !== lvl));
                                                }} className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 border-slate-300" />
                                                <span className="text-sm text-slate-600">{lvl}</span>
                                            </label>
                                        )) : <div className="text-xs text-slate-400">Loading...</div>}
                                    </div>
                                </div>
                            </details>
                        </div>

                        {/* Final Query */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2">
                                <FileText size={14}/> 補充要求
                            </label>
                            <textarea 
                                value={query} 
                                onChange={e => setQuery(e.target.value)} 
                                placeholder="例如：題目要包含地圖判讀，並強調因果關係..." 
                                className="w-full h-24 rounded-xl border-slate-200 px-4 py-3 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-none shadow-sm" 
                            />
                        </div>
                        
                        <div className="space-y-3">
                            {/* Standard Controls */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 flex-wrap gap-2">
                                 <div className="flex items-center gap-2">
                                     <input type="checkbox" id="useRewriting" checked={useQueryRewriting} onChange={e => setUseQueryRewriting(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                                     <label htmlFor="useRewriting" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1"><Sparkles size={12}/> AI 指令優化</label>
                                 </div>
                                 <div className="flex items-center gap-2 ml-auto">
                                     <label className="text-xs font-bold text-slate-500">數量</label>
                                     <input type="number" min="1" max="10" value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="w-14 rounded-lg border-slate-200 px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-blue-100" />
                                 </div>
                            </div>

                            {/* Highlighted Self-Reflection Control */}
                            <div className={`p-3 rounded-xl border transition-all ${enableSelfReflection ? "bg-indigo-50 border-indigo-200 shadow-sm" : "bg-white border-slate-200 border-dashed"}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <label htmlFor="useSelfReflection" className="flex items-center gap-2 cursor-pointer select-none">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${enableSelfReflection ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"}`}>
                                            {enableSelfReflection && <Check size={14} className="text-white" />}
                                        </div>
                                        <input type="checkbox" id="useSelfReflection" checked={enableSelfReflection} onChange={e => setEnableSelfReflection(e.target.checked)} className="hidden" />
                                        <span className={`text-sm font-bold flex items-center gap-1 ${enableSelfReflection ? "text-indigo-800" : "text-slate-500"}`}>
                                            AI 自我檢核 <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-extrabold tracking-wide uppercase">Beta</span>
                                        </span>
                                    </label>
                                </div>
                                <p className={`text-xs leading-relaxed ${enableSelfReflection ? "text-indigo-600" : "text-slate-400"}`}>
                                    啟用後，系統將在出題後自動扮演「教育專家」進行審查。若發現題目品質不佳（如選項不明確、誘答力不足），AI 會自動根據審查意見進行修正與重寫。
                                </p>
                            </div>
                        </div>

                        <button 
                            onClick={handleRun} 
                            disabled={loading || configLoading} 
                            className={`w-full py-4 rounded-xl text-white font-bold shadow-lg shadow-blue-200 transition-all transform active:scale-95 flex items-center justify-center gap-2 ${loading ? "bg-slate-400 cursor-not-allowed shadow-none" : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"}`}
                        >
                            {loading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> 生成中...</> : <><Play size={18} fill="currentColor"/> 開始出題</>}
                        </button>
                        
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                                <AlertCircle size={16} className="shrink-0 mt-0.5"/>
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. MIDDLE COLUMN: RESULTS */}
                <div className="w-full md:w-2/4 overflow-y-auto bg-slate-50/50 p-6 relative">
                     <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3">
                         <Activity size={20} className="text-blue-600"/>
                         <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">出題結果 Feed</h2>
                     </div>
                     
                     {loading && (
                         <div className="mb-8 p-6 bg-white rounded-2xl border border-blue-100 shadow-sm flex flex-col items-center gap-4 animate-pulse">
                             <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                 <Brain size={24} className="animate-bounce"/>
                             </div>
                             <div className="text-center space-y-1">
                                 <span className="block text-sm font-bold text-slate-700">AI 正在思考與撰寫題目...</span>
                                 <span className="block text-xs text-slate-400">正在檢索文獻並生成解析</span>
                             </div>
                         </div>
                     )}

                     {results.length > 0 ? (
                        <div className="space-y-6">
                            {results.map((res, i) => (
                                <BatchResult 
                                    key={res.log_id || i} // Prefer log_id
                                    result={res}
                                    batchIndex={i}
                                    totalBatches={results.length}
                                    examPaper={examPaper}
                                    onAddToExam={addToExamPaper}
                                />
                            ))}
                        </div>
                     ) : (
                         !loading && (
                            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-300">
                                <div className="p-6 bg-white rounded-full shadow-sm mb-4">
                                    <FileText size={48} className="text-slate-200" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-400">尚無生成內容</h3>
                                <p className="text-sm text-slate-400 mt-2">請在左側設定參數並點擊「開始出題」</p>
                            </div>
                         )
                     )}
                </div>

                {/* 3. RIGHT COLUMN: EXAM PAPER */}
                <div className="w-full md:w-1/4 min-w-[300px] overflow-y-auto bg-white p-5 border-l border-slate-200 scrollbar-thin">
                    <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <LayoutDashboard size={18} className="text-blue-600"/>
                            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">試卷預覽</h2>
                        </div>
                        <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm shadow-blue-200">
                            {examPaper.length}
                        </span>
                    </div>
                    
                    {examPaper.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-300 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50">
                            <Plus size={32} className="mb-2 opacity-50"/>
                            <p className="text-xs font-medium">尚未加入任何題目</p>
                            <p className="text-[10px] mt-1 opacity-70">請從中間欄位挑選題目</p>
                        </div>
                    ) : (
                        <div className="space-y-6 pb-24">
                            <div className="space-y-3">
                                {examPaper.map((q, idx) => renderQuestionCardPreview(q, idx))}
                            </div>
                            
                            <div className="sticky bottom-0 pt-4 bg-white/95 backdrop-blur border-t border-slate-100 space-y-2">
                                <button 
                                    onClick={() => setView("exam")}
                                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 mb-2"
                                >
                                    <PenTool size={16}/> 開始線上測驗
                                </button>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            const content = JSON.stringify(examPaper, null, 2);
                                            const blob = new Blob([content], {type: "application/json"});
                                            const url = URL.createObjectURL(blob);
                                            const link = document.createElement("a");
                                            link.href = url;
                                            link.download = `exam_paper_${Date.now()}.json`;
                                            link.click();
                                        }}
                                        className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center justify-center gap-1"
                                    >
                                        <Download size={14}/> JSON
                                    </button>
                                    <button 
                                        onClick={handleExportExamPaperCSV}
                                        className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center justify-center gap-1"
                                    >
                                        <FileText size={14}/> CSV
                                    </button>
                                    <button 
                                        onClick={handleExportExamPaperExcel}
                                        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm flex items-center justify-center gap-1"
                                    >
                                        <FileText size={14}/> Excel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        ) : view === "exam" ? (
            <ExamView questions={examPaper} onExit={() => setView("generator")} />
        ) : (
            // ADMIN VIEW WRAPPER
            <div className="flex h-full bg-slate-50 overflow-hidden relative">
                {/* BACK BUTTON */}
                <div className="absolute top-4 right-4 z-50">
                    <button onClick={() => setView("generator")} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 text-sm font-bold flex items-center gap-2">
                        <ChevronRight size={16} className="rotate-180"/> 返回出題
                    </button>
                </div>

                {/* NEW ADMIN DASHBOARD COMPONENT */}
                <div className="w-full h-full flex-1">
                    <AdminDashboard 
                        user={user}
                        currentView={adminView}
                        setCurrentView={setAdminView}
                        onManageUsers={fetchUsers}
                        onManagePrompts={() => {}}
                        onViewLogs={fetchLogs}
                    />
                </div>

                {/* Content Overlay for Sub-Views */}
                {adminView !== "dashboard" && (
                    <div className="absolute inset-0 left-64 bg-slate-50 z-10 overflow-y-auto p-8">
                        {adminView === "users" && user?.role === 'admin' && (
                            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-300">
                                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Users size={20}/> 使用者管理</h2>
                                <div className="flex gap-4 mb-6 items-end p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label><input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="border rounded-lg p-2 text-sm w-48" /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label><input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="border rounded-lg p-2 text-sm w-48" /></div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                                        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="border rounded-lg p-2 text-sm bg-white">
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <button onClick={handleAddUser} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-bold shadow-sm">Add User</button>
                                </div>
                                <div className="overflow-hidden rounded-xl border border-slate-200">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                            <tr><th className="px-6 py-3 font-semibold">Username</th><th className="px-6 py-3 font-semibold">Role</th><th className="px-6 py-3 font-semibold">Action</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {usersList.map(u => (
                                                <tr key={u.username} className="hover:bg-slate-50">
                                                    <td className="px-6 py-3 font-medium text-slate-700">{u.username}</td>
                                                    <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                                                    <td className="px-6 py-3">{u.username !== 'admin' && <button onClick={() => handleDeleteUser(u.username)} className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1"><Trash2 size={16}/></button>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {adminView === "prompts" && (
                            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-300">
                                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={20}/> Prompt Template Editor</h2>
                                <div className="flex gap-4 mb-4 items-center">
                                    <select value={editingPromptMode} onChange={e => { setEditingPromptMode(e.target.value); setEditingPromptContent(config?.prompt_templates?.[e.target.value] || ""); }} className="p-2 border rounded-lg bg-slate-50 font-medium text-sm">
                                        {config?.prompt_templates && Object.keys(config.prompt_templates).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <button onClick={handleSavePrompt} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm flex items-center gap-2"><Check size={16}/> Save Prompt</button>
                                    <span className="text-sm text-green-600 font-medium">{promptSaveStatus}</span>
                                </div>
                                <textarea value={editingPromptContent} onChange={e => setEditingPromptContent(e.target.value)} className="w-full h-[500px] font-mono text-xs p-4 bg-slate-900 text-slate-200 border border-slate-700 rounded-xl leading-relaxed" />
                            </div>
                        )}

                        {adminView === "logs" && (
                            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileText size={20}/> 歷史紀錄</h2>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleExportAll("json")} className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Download size={14}/> JSON</button>
                                        <button onClick={() => handleExportAll("csv")} className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Download size={14}/> CSV</button>
                                        <button onClick={fetchLogs} className="text-xs text-blue-600 hover:underline ml-2 font-medium">Refresh</button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold w-32">Time</th>
                                                <th className="px-4 py-3 font-semibold w-24">User</th>
                                                <th className="px-4 py-3 font-semibold">Query / Info</th>
                                                <th className="px-4 py-3 font-semibold w-16 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {logs.map((log) => (
                                                <tr key={log.id} onClick={() => setExpandedLog(log)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                                                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                                                        <div className="font-bold text-slate-700">{new Date(log.timestamp).toLocaleDateString()}</div>
                                                        <div className="text-[10px] opacity-80">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded text-center truncate">
                                                            {log.username || "anon"}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="max-w-md">
                                                            <div className="truncate text-sm font-medium text-slate-800">{log.query}</div>
                                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                                                <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{log.params?.model || "model"}</span>
                                                                {log.params?.enable_self_reflection && (
                                                                    <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                                                                        <Sparkles size={10} /> AI Review
                                                                    </span>
                                                                )}
                                                                {log.params?.subject && <span>• {log.params.subject}</span>}
                                                                {log.params?.count && <span>• {log.params.count}題</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {user?.role === 'admin' && (
                                                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                            <button 
                                                                onClick={() => handleDeleteLog(log.id)} 
                                                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-2 transition-all opacity-0 group-hover:opacity-100"
                                                                title="刪除紀錄"
                                                            >
                                                                <Trash2 size={16}/>
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {expandedLog && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setExpandedLog(null)}>
                                <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                                    
                                    {/* Header */}
                                    <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/80 backdrop-blur">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center shadow-lg shadow-blue-200">
                                                <span className="text-[10px] font-bold opacity-60">ID</span>
                                                <span className="text-lg font-black leading-none">#{expandedLog.id}</span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">生成日誌詳情</h3>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Clock size={12}/>
                                                    <span>{new Date(expandedLog.timestamp).toLocaleString()}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <Users size={12}/>
                                                    <span>{expandedLog.username || "anonymous"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleExportSingle(expandedLog, "json")} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"><Download size={14}/> JSON</button>
                                            <button onClick={() => setExpandedLog(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
                                        
                                        {/* DEBUG INFO (Temporary) */}
                                        <div className="bg-slate-800 text-green-400 p-4 rounded-xl font-mono text-xs overflow-auto max-h-40 border border-slate-700 shadow-inner">
                                            <div className="font-bold border-b border-slate-700 pb-1 mb-2 text-white">DEBUG: Data Inspector</div>
                                            <div>Self-Reflection Enabled: {String(expandedLog.params?.enable_self_reflection)}</div>
                                            <div>Questions Count: {(expandedLog.response as any)?.length || (expandedLog.response as any)?.questions?.length || 0}</div>
                                            <div>Review Data Type: {typeof (expandedLog as any).review_data}</div>
                                            <div>Review Data Length: {Array.isArray((expandedLog as any).review_data) ? (expandedLog as any).review_data.length : 'N/A'}</div>
                                            <div>Review Indices: {Array.isArray((expandedLog as any).review_data) ? (expandedLog as any).review_data.map((r:any) => r.index).join(', ') : 'None'}</div>
                                            <div className="mt-2 text-slate-500 whitespace-pre-wrap">{JSON.stringify((expandedLog as any).review_data, null, 2).slice(0, 500)}...</div>
                                        </div>

                                        {/* 1. Request Info */}
                                        <section>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <Activity size={14}/> Request Parameters
                                            </h4>
                                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6">
                                                <div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Query</div>
                                                    <div className="text-sm font-medium text-slate-800 break-words">{expandedLog.query}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Model</div>
                                                    <div className="text-sm font-bold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">{expandedLog.params?.model || "-"}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Subject / Topic</div>
                                                    <div className="text-sm text-slate-700">
                                                        {expandedLog.params?.subject || "-"} 
                                                        <span className="text-slate-300 mx-1">/</span>
                                                        {expandedLog.params?.topic || "-"}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Config</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {expandedLog.params?.enable_self_reflection && <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">Self-Reflection</span>}
                                                        {expandedLog.params?.use_query_rewriting && <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold">Rewriting</span>}
                                                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">TopK: {expandedLog.params?.top_k}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        {/* 2. Generated Output & Review Details */}
                                        <section>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <FileText size={14}/> Generated Output & Review
                                            </h4>
                                            {(() => {
                                                let questionsList: any[] = [];
                                                if (Array.isArray(expandedLog.response)) {
                                                    questionsList = expandedLog.response;
                                                } else if (expandedLog.response && Array.isArray(expandedLog.response.questions)) {
                                                    questionsList = expandedLog.response.questions;
                                                }
                                                
                                                if (questionsList.length > 0) {
                                                    return (
                                                        <div className="space-y-6">
                                                            {questionsList.map((q: any, idx: number) => {
                                                                // Find matching review data (Robust Matching)
                                                                let reviewData = null;
                                                                const rawReviewData = (expandedLog as any).review_data;
                                                                if (rawReviewData) {
                                                                    const reviews = Array.isArray(rawReviewData) ? rawReviewData : [rawReviewData];
                                                                    reviewData = reviews.find((r: any) => {
                                                                        const rIdx = r.index !== undefined ? parseInt(String(r.index), 10) : -999;
                                                                        // Match 0-based, 1-based, or Force Match if 1:1
                                                                        return rIdx === idx || rIdx === idx + 1 || (questionsList.length === 1 && reviews.length === 1);
                                                                    });
                                                                }

                                                                const wasOptimized = reviewData?.optimization_summary != null;
                                                                const initialEval = reviewData?.initial_evaluation;
                                                                const finalEval = reviewData?.final_evaluation;

                                                                return (
                                                                    <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                                        {/* Main Question Card */}
                                                                        <div className="p-6">
                                                                            <div className="flex items-start gap-3 mb-4">
                                                                                <span className="flex-shrink-0 w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-sm font-bold">#{idx+1}</span>
                                                                                <div className="flex-1">
                                                                                    <div className="text-base font-bold text-slate-800 leading-relaxed mb-4">{q["題幹"]}</div>
                                                                                    <div className="space-y-2 mb-4">
                                                                                        {["A", "B", "C", "D"].map((opt, oi) => {
                                                                                            const label = String.fromCharCode(65 + oi);
                                                                                            const optText = q[`選項${label}`];
                                                                                            const isAns = q["正確答案"] && (q["正確答案"].includes(label) || q["正確答案"] === optText);
                                                                                            return (
                                                                                                <div key={oi} className={`text-sm p-2 rounded-lg flex gap-3 ${isAns ? "bg-green-50 text-green-800 font-bold border border-green-100" : "bg-white border border-slate-100 text-slate-600"}`}>
                                                                                                    <span className={`w-5 flex-shrink-0 ${isAns ? "text-green-600" : "text-slate-400"}`}>{label}.</span>
                                                                                                    <span>{optText}</span>
                                                                                                    {isAns && <Check size={16} className="ml-auto text-green-600"/>}
                                                                                                </div>
                                                                                            )
                                                                                        })}
                                                                                    </div>
                                                                                    <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-600 leading-relaxed border border-slate-100">
                                                                                        <span className="font-bold text-slate-700 block mb-1">解析：</span>
                                                                                        {q["解析"]}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Embedded Review Report (Always Visible if exists) */}
                                                                        {reviewData && (
                                                                            <div className="border-t border-slate-200 bg-slate-50/80 p-6">
                                                                                <div className="flex items-center gap-3 mb-4">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Activity size={16} className="text-blue-600"/>
                                                                                        <h5 className="text-sm font-bold text-slate-700 uppercase tracking-wide">AI Quality Report</h5>
                                                                                    </div>
                                                                                    {wasOptimized ? (
                                                                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg border border-purple-200 flex items-center gap-1"><Sparkles size={12}/> Optimized</span>
                                                                                    ) : (
                                                                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg border border-green-200 flex items-center gap-1"><Check size={12}/> Pass</span>
                                                                                    )}
                                                                                    <span className="text-xs font-mono text-slate-500 font-medium">
                                                                                        Score: <span className={initialEval?.total_score >= 18 ? "text-green-600" : "text-red-500"}>{initialEval?.total_score}</span> 
                                                                                        <span className="mx-1 text-slate-300">→</span> 
                                                                                        <span className="text-green-700 font-bold">{finalEval?.total_score || initialEval?.total_score}</span>
                                                                                    </span>
                                                                                </div>
                                                                                
                                                                                <div className="space-y-6">
                                                                                    {/* Optimization Strategy */}
                                                                                    {wasOptimized && (
                                                                                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                                                                            <div className="text-xs font-bold text-purple-800 mb-2 uppercase tracking-wider flex items-center gap-2"><Sparkles size={12}/> Optimization Strategy</div>
                                                                                            <div className="grid grid-cols-1 gap-3">
                                                                                                <div className="bg-white/60 p-3 rounded-lg border border-purple-100/50">
                                                                                                    <span className="text-[10px] font-bold text-purple-400 uppercase block mb-1">Major Issues</span>
                                                                                                    <div className="text-xs text-slate-700 leading-relaxed">{reviewData.optimization_summary.major_issues}</div>
                                                                                                </div>
                                                                                                <div className="bg-white/60 p-3 rounded-lg border border-purple-100/50">
                                                                                                    <span className="text-[10px] font-bold text-purple-400 uppercase block mb-1">Strategy</span>
                                                                                                    <div className="text-xs text-slate-700 leading-relaxed">{reviewData.optimization_summary.strategy}</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Evaluation Grid */}
                                                                                    <div className={`grid grid-cols-1 ${wasOptimized ? "md:grid-cols-2" : ""} gap-6`}>
                                                                                        {/* Initial */}
                                                                                        <div className={`p-4 rounded-xl border ${wasOptimized ? "bg-red-50/40 border-red-100" : "bg-white border-slate-200"}`}>
                                                                                            <div className={`font-bold mb-3 text-xs uppercase flex items-center gap-2 ${wasOptimized ? "text-red-700" : "text-slate-600"}`}>
                                                                                                <span className={`w-2 h-2 rounded-full ${wasOptimized ? "bg-red-500" : "bg-slate-400"}`}></span>
                                                                                                {wasOptimized ? "Initial Evaluation (Before)" : "Quality Evaluation"}
                                                                                            </div>
                                                                                            {/* Scores Table */}
                                                                                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-3">
                                                                                                <table className="w-full text-left text-[10px]">
                                                                                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                                                                                        <tr><th className="px-3 py-2">Criteria</th><th className="px-3 py-2 text-center">Score</th></tr>
                                                                                                    </thead>
                                                                                                    <tbody className="divide-y divide-slate-50">
                                                                                                        {initialEval?.criteria_scores && Object.entries(initialEval.criteria_scores).map(([k, s]: [string, any]) => (
                                                                                                            <tr key={k}>
                                                                                                                <td className="px-3 py-1.5 text-slate-600">{k}</td>
                                                                                                                <td className={`px-3 py-1.5 text-center font-bold ${s===3?"text-green-600":s<2?"text-red-500":"text-amber-500"}`}>{s}/3</td>
                                                                                                            </tr>
                                                                                                        ))}
                                                                                                        <tr className="bg-slate-50 font-bold border-t border-slate-100">
                                                                                                            <td className="px-3 py-2 text-slate-700">Total Score</td>
                                                                                                            <td className="px-3 py-2 text-center text-slate-800">{initialEval?.total_score}/21</td>
                                                                                                        </tr>
                                                                                                    </tbody>
                                                                                                </table>
                                                                                            </div>
                                                                                            {initialEval?.comments && (
                                                                                                <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 italic leading-relaxed">
                                                                                                    <span className="text-[10px] font-bold text-slate-300 uppercase block mb-1">Comments</span>
                                                                                                    {initialEval.comments}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* Final */}
                                                                                        {wasOptimized && (
                                                                                            <div className="bg-green-50/40 p-4 rounded-xl border border-green-100">
                                                                                                <div className="font-bold text-green-700 mb-3 text-xs uppercase flex items-center gap-2">
                                                                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                                                                    Final Evaluation (After)
                                                                                                </div>
                                                                                                <div className="bg-white rounded-lg border border-green-100 overflow-hidden mb-3">
                                                                                                    <table className="w-full text-left text-[10px]">
                                                                                                        <thead className="bg-green-50 text-green-700 font-semibold border-b border-green-100">
                                                                                                            <tr><th className="px-3 py-2">Criteria</th><th className="px-3 py-2 text-center">Score</th></tr>
                                                                                                        </thead>
                                                                                                        <tbody className="divide-y divide-green-50">
                                                                                                            {finalEval?.criteria_scores && Object.entries(finalEval.criteria_scores).map(([k, s]: [string, any]) => (
                                                                                                                <tr key={k}>
                                                                                                                    <td className="px-3 py-1.5 text-slate-600">{k}</td>
                                                                                                                    <td className={`px-3 py-1.5 text-center font-bold ${s===3?"text-green-600":s<2?"text-red-500":"text-amber-500"}`}>{s}/3</td>
                                                                                                                </tr>
                                                                                                            ))}
                                                                                                            <tr className="bg-green-50 font-bold border-t border-green-100">
                                                                                                                <td className="px-3 py-2 text-green-800">Total Score</td>
                                                                                                                <td className="px-3 py-2 text-center text-green-800">{finalEval?.total_score}/21</td>
                                                                                                            </tr>
                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                </div>
                                                                                                {finalEval?.comments && (
                                                                                                    <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-green-100 italic leading-relaxed">
                                                                                                        <span className="text-[10px] font-bold text-green-300 uppercase block mb-1">Comments</span>
                                                                                                        {finalEval.comments}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Comparison */}
                                                                                    {wasOptimized && reviewData.original_question && (
                                                                                        <div className="mt-4 pt-4 border-t border-slate-200">
                                                                                            <h5 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-2"><FileText size={14}/> Content Comparison</h5>
                                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                                                {/* Before */}
                                                                                                <div className="p-4 bg-red-50 rounded-xl border border-red-100 relative">
                                                                                                    <div className="absolute top-3 right-3 px-2 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-bold uppercase">Before</div>
                                                                                                    <div className="font-medium text-slate-800 mb-3 pr-10 leading-relaxed">{reviewData.original_question["題幹"]}</div>
                                                                                                    <div className="space-y-1.5 pl-3 border-l-2 border-red-200 mb-3">
                                                                                                        {["A","B","C","D"].map(opt => (
                                                                                                            <div key={opt} className={`flex gap-2 ${reviewData.original_question["正確答案"]?.includes(opt) || reviewData.original_question["正確答案"] === reviewData.original_question[`選項${opt}`] ? "text-red-700 font-bold" : "text-slate-500"}`}>
                                                                                                                <span className="w-3">{opt}.</span><span>{reviewData.original_question[`選項${opt}`]}</span>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                    <div className="text-[10px] font-bold text-red-600 bg-red-100/50 px-2 py-1 rounded inline-block">Ans: {reviewData.original_question["正確答案"]}</div>
                                                                                                </div>
                                                                                                
                                                                                                {/* After */}
                                                                                                <div className="p-4 bg-green-50 rounded-xl border border-green-100 relative">
                                                                                                    <div className="absolute top-3 right-3 px-2 py-0.5 bg-green-100 text-green-600 rounded text-[9px] font-bold uppercase">After</div>
                                                                                                    <div className="font-medium text-slate-800 mb-3 pr-10 leading-relaxed">{q["題幹"]}</div>
                                                                                                    <div className="space-y-1.5 pl-3 border-l-2 border-green-200 mb-3">
                                                                                                        {["A","B","C","D"].map(opt => (
                                                                                                            <div key={opt} className={`flex gap-2 ${q["正確答案"]?.includes(opt) || q["正確答案"] === q[`選項${opt}`] ? "text-green-700 font-bold" : "text-slate-500"}`}>
                                                                                                                <span className="w-3">{opt}.</span><span>{q[`選項${opt}`]}</span>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                    <div className="text-[10px] font-bold text-green-600 bg-green-100/50 px-2 py-1 rounded inline-block">Ans: {q["正確答案"]}</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div className="bg-slate-900 p-4 rounded-xl overflow-x-auto">
                                                            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{JSON.stringify(expandedLog.response, null, 2)}</pre>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </section>
                                        
                                        {/* 4. Raw Debug Toggle */}
                                        <details className="group pt-4 border-t border-slate-200">
                                            <summary className="cursor-pointer text-xs font-bold text-slate-400 hover:text-blue-600 flex items-center gap-2 select-none">
                                                <Database size={12}/> Show Raw Log Data
                                            </summary>
                                            <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-inner overflow-hidden">
                                                <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
                                                    {JSON.stringify(expandedLog, null, 2)}
                                                </pre>
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
      }
      </div>
    </div>
  );
};

export default App;