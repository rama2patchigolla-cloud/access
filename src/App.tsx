/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Settings, 
  User, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Save, 
  FileJson, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  LayoutDashboard,
  Server,
  Cloud,
  FileText
} from 'lucide-react';

// --- Types ---

type QuestionType = 'text' | 'dropdown' | 'multiselect' | 'info';

interface Question {
  id: string;
  category: string;
  text: string;
  description?: string;
  type: QuestionType;
  options?: string[];
  next?: string; // Default next question ID
  logic?: Record<string, string>; // Answer -> Next Question ID
  required?: boolean;
}

// --- Initial Question Bank ---

const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q_intro',
    category: 'NYU IT',
    text: 'Welcome to the NYU IT Enterprise Data Management Portal',
    description: 'This strategic data request onboarding process assists NYU IT and academic departments in routing data-sharing requests to the appropriate integration pipelines. All submissions are automatically evaluated against NYU IT Data Governance, Information Security policies, and Records Retention rules.',
    type: 'info',
    next: 'q_contact'
  },
  {
    id: 'q_contact',
    category: 'Demographics',
    text: 'Contact Information',
    description: 'Enter the coordinator details: Contact Person Name / official NYU NetID / Sponsoring Department (e.g., CAS, Stern, Tandon, Tisch, IT)',
    type: 'text',
    required: true,
    next: 'q_app_name'
  },
  {
    id: 'q_app_name',
    category: 'Demographics',
    text: 'Sponsoring Application Name',
    type: 'text',
    required: true,
    next: 'q_app_desc'
  },
  {
    id: 'q_app_desc',
    category: 'Demographics',
    text: 'Application Description & Sponsoring Business Case',
    type: 'text',
    required: true,
    next: 'q_security'
  },
  {
    id: 'q_security',
    category: 'InfoSec Compliance',
    text: 'Application Security Architecture Details',
    description: 'Describe authentication (e.g. NYU MFA, Shibboleth, Active Directory), encryption (TSL, SSL at rest/transit), and access control mechanisms.',
    type: 'text',
    next: 'q_persistence'
  },
  {
    id: 'q_persistence',
    category: 'InfoSec Compliance',
    text: 'Application Data Persistence Details',
    description: 'Specify where the data will reside (e.g. Cloud Database, On-Prem servers, local cache, external host).',
    type: 'text',
    next: 'q_archive'
  },
  {
    id: 'q_archive',
    category: 'NYU Records Policy',
    text: 'NYU Records Retention & Archive Policy Compliance',
    description: 'Select the retention schedule that aligns with official NYU Records Management guidelines for your data domain.',
    type: 'dropdown',
    options: [
      '7 Years (Standard Financial/Legal Retention Schedule)',
      '10 Years (Extended Sponsoring Retention Requirement)',
      '3 Years (Operational / Academic Short-term Records)',
      '1 Year (Transient / Temporary File Integration)',
      'Permanent / Indefinite Academic Preservation Archive',
      'Custom (Explicit Review by NYU Data Stewardship Required)'
    ],
    next: 'q_users'
  },
  {
    id: 'q_users',
    category: 'Audience Control',
    text: 'Authorized Application User Base',
    type: 'multiselect',
    options: ['Inside NYU IT Staff', 'Active NYU Students', 'Affiliate / NYU Global Site Members', 'Outside NYU Vendors / Third-Party Partners'],
    required: true,
    next: 'q_purpose'
  },
  {
    id: 'q_purpose',
    category: 'Segment Routing',
    text: 'What is the primary operational category for this data onboarding?',
    type: 'dropdown',
    options: [
      'Analysis / NYU Management Reports & Executive Dashboards',
      'IT Application Integration / System REST API Syncing',
      'On-demand Row Level Data / Scheduled SFTP Data pipelines'
    ],
    required: true,
    logic: {
      'Analysis / NYU Management Reports & Executive Dashboards': 'q_report_type',
      'IT Application Integration / System REST API Syncing': 'q_app_status',
      'On-demand Row Level Data / Scheduled SFTP Data pipelines': 'q_ondemand_details'
    }
  },
  {
    id: 'q_report_type',
    category: 'Infrastructure',
    text: 'What type of reporting/analytics output does your department require?',
    type: 'dropdown',
    options: [
      'NYU Tableau Server Managed Dashboard',
      'Secure Aggregated Data Feed (SFTP CSV/JSON)',
      'Consolidated Databridge Space (Data Virtuality View)',
      'Direct Snowflake Read-Only Analytics Account'
    ],
    next: 'q_sensitivity'
  },
  {
    id: 'q_app_status',
    category: 'Status Check',
    text: 'What is the integration status of this application?',
    type: 'dropdown',
    options: [
      'Existing NYU Application (Long-term continuous authorization)',
      'New NYU Application / Dynamic Feature Release (First Time Onboarding)'
    ],
    required: true,
    logic: {
      'Existing NYU Application (Long-term continuous authorization)': 'q_existing_artifact',
      'New NYU Application / Dynamic Feature Release (First Time Onboarding)': 'q_it_assessment'
    }
  },
  {
    id: 'q_existing_artifact',
    category: 'Compliance Check',
    text: 'Do you have an existing EDM Data Access Artifact or documented consent?',
    description: 'If your application is already fully approved for parallel workflows, we can expedite the pipeline authorization process without full re-stewardship.',
    type: 'dropdown',
    options: ['Yes, existing artifact on file', 'No, this is a completely new data requirement'],
    logic: {
      'Yes, existing artifact on file': 'q_success_expedited',
      'No, this is a completely new data requirement': 'q_sensitivity'
    }
  },
  {
    id: 'q_it_assessment',
    category: 'Security Assessment',
    text: 'Approved NYU IT Assessment Number',
    description: 'New integrations typically require an NYU IT Service assessment. Enter your IT Assessment Approval # if completed, or enter "Pending" to request one.',
    type: 'text',
    next: 'q_sensitivity'
  },
  {
    id: 'q_sensitivity',
    category: 'Risk Classification',
    text: 'Under NYU Data Classification Policy, what is the data sensitivity level?',
    type: 'dropdown',
    options: [
      'Non-Sensitive NYU Public Information',
      'Sensitive (FERPA Records, NetID, PII, PHI, Financial, or HR Records)'
    ],
    required: true,
    logic: {
      'Non-Sensitive NYU Public Information': 'q_tech_choice',
      'Sensitive (FERPA Records, NetID, PII, PHI, Financial, or HR Records)': 'q_steward_review'
    }
  },
  {
    id: 'q_steward_review',
    category: 'Stewardship',
    text: 'NYU Data Steward Approval Requirement',
    description: 'Sensitive/Restricted data request triggers formal review. Do you already have signed consent or documented approval from the respective School/Domain Data Steward?',
    type: 'dropdown',
    options: [
      'Yes, signed authorization attached/ready to integrate',
      'No, I request the EDM Team to coordinate with NYU Stewardship'
    ],
    next: 'q_tech_choice'
  },
  {
    id: 'q_tech_choice',
    category: 'Technology Selection',
    text: 'Which NYU EDM host technology do you intend to interface with?',
    type: 'multiselect',
    options: [
      'MuleSoft Client Enterprise API Gateway',
      'Snowflake View-Level Secure Data Sharing',
      'Data Virtuality Logical Data Warehouse Solution',
      'Wherscape Automation Redshift/Database target',
      'NYU Tableau Self-Service Dashboard Suite',
      'Secure AWS S3 NYU Bucket Space',
      'Secure NYU SFTP Academic Transfer'
    ],
    next: 'q_success_standard'
  },
  {
    id: 'q_ondemand_details',
    category: 'Data Requirements',
    text: 'Please describe the scheduled or on-demand row-level data query requirements.',
    type: 'text',
    next: 'q_sensitivity'
  },
  {
    id: 'q_success_expedited',
    category: 'Authorization Status',
    text: 'Strategic Pre-Approval Authorized!',
    description: 'Based on the provided long-term NYU Application status and existing certified access records, NYU IT Enterprise Data Management has approved this request in expedited "Inform-Steward" mode. Data integration setups will be triggered automatically.',
    type: 'info',
    next: undefined
  },
  {
    id: 'q_success_standard',
    category: 'Authorization Status',
    text: 'strategic onboarding request received',
    description: 'Thank you for submitting your NYU EDM onboarding application. The Enterprise Data Management group and NYU Information Security Officers will review your system specifications and classification details. You will receive an automated IT notice on your NYU NetID email.',
    type: 'info',
    next: undefined
  }
];

// --- Components ---

const AdminPanel = ({ questions, setQuestions }: { questions: Question[], setQuestions: (q: Question[]) => void }) => {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(JSON.stringify(questions, null, 2));

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setQuestions(parsed);
      setJsonMode(false);
    } catch (e) {
      alert('Invalid JSON format');
    }
  };

  const addQuestion = () => {
    const newId = `q_${Date.now()}`;
    setQuestions([...questions, {
      id: newId,
      category: 'New Category',
      text: 'New Question Text',
      type: 'text'
    }]);
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5" /> Question Bank Manager
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setJsonText(JSON.stringify(questions, null, 2));
              setJsonMode(!jsonMode);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-nyu-violet bg-nyu-violet-bg rounded-lg hover:bg-nyu-violet-accent transition-colors cursor-pointer"
          >
            <FileJson className="w-4 h-4" /> {jsonMode ? 'Visual Editor' : 'JSON Editor'}
          </button>
          {!jsonMode && (
            <button 
              onClick={addQuestion}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-nyu-violet rounded-lg hover:bg-nyu-violet-hover focus:outline-none focus:ring-2 focus:ring-nyu-violet transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          )}
        </div>
      </div>

      {jsonMode ? (
        <div className="space-y-4">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full h-[600px] p-4 font-mono text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-nyu-violet focus:border-transparent outline-none"
          />
          <button 
            onClick={handleSaveJson}
            className="flex items-center gap-2 px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Save className="w-4 h-4" /> Save JSON Changes
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {questions.map((q) => (
            <div key={q.id} className="p-6 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">ID</label>
                    <input 
                      value={q.id} 
                      onChange={(e) => updateQuestion(q.id, { id: e.target.value })}
                      className="w-full p-2 text-sm border border-gray-200 rounded bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category</label>
                    <input 
                      value={q.category} 
                      onChange={(e) => updateQuestion(q.id, { category: e.target.value })}
                      className="w-full p-2 text-sm border border-gray-200 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Type</label>
                    <select 
                      value={q.type} 
                      onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                      className="w-full p-2 text-sm border border-gray-200 rounded"
                    >
                      <option value="text">Text Input</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="multiselect">Multi-Select</option>
                      <option value="info">Info/Success Screen</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => deleteQuestion(q.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Question Text</label>
                  <input 
                    value={q.text} 
                    onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-200 rounded"
                  />
                </div>
                
                {(q.type === 'dropdown' || q.type === 'multiselect') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Options (comma separated)</label>
                    <input 
                      value={q.options?.join(', ') || ''} 
                      onChange={(e) => updateQuestion(q.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                      className="w-full p-2 text-sm border border-gray-200 rounded"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Default Next ID</label>
                    <input 
                      value={q.next || ''} 
                      onChange={(e) => updateQuestion(q.id, { next: e.target.value || undefined })}
                      className="w-full p-2 text-sm border border-gray-200 rounded"
                      placeholder="e.g. q2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Logic (JSON Map: Answer → ID)</label>
                    <input 
                      value={q.logic ? JSON.stringify(q.logic) : ''} 
                      onChange={(e) => {
                        try {
                          const logic = e.target.value ? JSON.parse(e.target.value) : undefined;
                          updateQuestion(q.id, { logic });
                        } catch (e) {}
                      }}
                      className="w-full p-2 text-sm border border-gray-200 rounded font-mono"
                      placeholder='{"Option A": "q3"}'
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const UserPortal = ({ questions }: { questions: Question[] }) => {
  const [history, setHistory] = useState<string[]>(['q_intro']);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentValue, setCurrentValue] = useState<any>('');
  const [isFinished, setIsFinished] = useState(false);

  const currentId = history[history.length - 1];
  const currentQuestion = useMemo(() => questions.find(q => q.id === currentId), [questions, currentId]);

  // Consolidate General questions
  const CONSOLIDATED_IDS = ['q_contact', 'q_app_name', 'q_app_desc', 'q_security', 'q_persistence', 'q_archive', 'q_users'];
  const isGeneralStep = CONSOLIDATED_IDS.includes(currentId);
  const generalQuestions = useMemo(() => 
    questions.filter(q => CONSOLIDATED_IDS.includes(q.id)),
    [questions]
  );

  const handleNext = () => {
    if (!currentQuestion) return;

    let nextId: string | undefined;

    if (isGeneralStep) {
      // For consolidated view, we use the 'next' of the LAST general question
      const lastGeneral = generalQuestions[generalQuestions.length - 1];
      nextId = lastGeneral.next;
    } else {
      // Save answer for single question
      const newAnswers = { ...answers, [currentId]: currentValue };
      setAnswers(newAnswers);

      // Determine next ID
      if (currentQuestion.logic && currentValue && currentQuestion.logic[currentValue]) {
        nextId = currentQuestion.logic[currentValue];
      } else {
        nextId = currentQuestion.next;
      }
    }

    if (nextId) {
      setHistory([...history, nextId]);
      setCurrentValue('');
    } else {
      setIsFinished(true);
    }
  };

  const handleBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      setHistory(newHistory);
      const prevId = newHistory[newHistory.length - 1];
      
      // If going back to a consolidated view, we don't set a single currentValue
      if (!CONSOLIDATED_IDS.includes(prevId) || prevId === 'q_intro') {
        setCurrentValue(answers[prevId] || '');
      }
    }
  };

  const progress = (history.length / questions.length) * 100;

  if (isFinished) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto bg-white p-12 rounded-3xl shadow-xl text-center"
      >
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Submission Successful</h2>
        <p className="text-gray-600 mb-8">Your data request has been logged in the EDM Strategic Onboarding System. Our team will review the details and contact you shortly.</p>
        <button 
          onClick={() => {
            setHistory(['q_intro']);
            setAnswers({});
            setIsFinished(false);
          }}
          className="px-8 py-3 bg-nyu-violet text-white font-semibold rounded-xl hover:bg-nyu-violet-hover focus:outline-none focus:ring-2 focus:ring-nyu-violet focus:ring-offset-2 transition-all shadow-lg shadow-nyu-violet/25"
        >
          Start New Request
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8 px-4">
        <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
          <span>Progress</span>
          <span>Step {history.length} of {questions.length}</span>
        </div>
        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress + 10, 100)}%` }}
            className="h-full bg-nyu-violet rounded-full"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={isGeneralStep ? 'general-group' : currentId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100"
        >
          <div className="mb-6">
            <span className="px-3.5 py-1 bg-nyu-violet-bg text-nyu-violet text-xs font-extrabold rounded-full uppercase tracking-wider border border-nyu-violet-accent/40">
              {currentQuestion?.category}
            </span>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">
            {isGeneralStep ? 'General Information' : currentQuestion?.text}
          </h2>
          
          {currentQuestion?.description && !isGeneralStep && (
            <p className="text-gray-500 mb-8 text-lg">
              {currentQuestion.description}
            </p>
          )}

          <div className="space-y-6 mb-12">
            {isGeneralStep ? (
              <div className="space-y-8">
                {generalQuestions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">
                      {q.text} {q.required && <span className="text-red-500">*</span>}
                    </label>
                    {q.description && <p className="text-xs text-gray-400">{q.description}</p>}
                    
                    {q.type === 'text' && (
                      <input 
                        type="text"
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:border-nyu-violet focus:ring-2 focus:ring-nyu-violet/15 outline-none transition-all bg-white text-slate-900"
                        placeholder={`Enter ${q.text.toLowerCase()}...`}
                      />
                    )}

                    {q.type === 'dropdown' && (
                      <select
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:border-nyu-violet focus:ring-2 focus:ring-nyu-violet/15 outline-none transition-all bg-white text-slate-900"
                      >
                        <option value="">Select an option...</option>
                        {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}

                    {q.type === 'multiselect' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options?.map((opt) => {
                          const isSelected = Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                const currentArr = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                                const newArr = isSelected 
                                  ? currentArr.filter((v: string) => v !== opt)
                                  : [...currentArr, opt];
                                setAnswers({ ...answers, [q.id]: newArr });
                              }}
                              className={`p-3 text-left text-sm font-semibold rounded-xl border transition-all cursor-pointer ${
                                isSelected 
                                  ? 'border-nyu-violet bg-nyu-violet-bg text-nyu-violet shadow-sm shadow-nyu-violet/5' 
                                  : 'border-slate-200 hover:border-nyu-violet/40 hover:bg-nyu-violet-bg/30 text-slate-700'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                {currentQuestion?.type === 'text' && (
                  <input 
                    autoFocus
                    type="text"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && currentValue && handleNext()}
                    className="w-full p-4 text-lg border border-slate-300 rounded-2xl focus:border-nyu-violet focus:ring-2 focus:ring-nyu-violet/15 outline-none transition-all bg-white text-slate-900 animate-fade-in"
                    placeholder="Enter your response..."
                  />
                )}

                {currentQuestion?.type === 'dropdown' && (
                  <div className="grid grid-cols-1 gap-3">
                    {currentQuestion.options?.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setCurrentValue(opt);
                          // Auto-advance for dropdowns if it's a single choice
                          setTimeout(() => {
                            const newAnswers = { ...answers, [currentId]: opt };
                            setAnswers(newAnswers);
                            let nextId = (currentQuestion.logic && currentQuestion.logic[opt]) || currentQuestion.next;
                            if (nextId) setHistory([...history, nextId]);
                            else setIsFinished(true);
                            setCurrentValue('');
                          }, 200);
                        }}
                        className={`w-full p-4 text-left text-lg font-bold rounded-2xl border transition-all flex justify-between items-center group cursor-pointer ${
                          currentValue === opt 
                            ? 'border-nyu-violet bg-nyu-violet-bg text-nyu-violet shadow-sm' 
                            : 'border-slate-200 hover:border-nyu-violet/40 hover:bg-nyu-violet-bg/30 text-slate-700'
                        }`}
                      >
                        {opt}
                        <ChevronRight className={`w-5 h-5 transition-transform ${currentValue === opt ? 'translate-x-1 text-nyu-violet' : 'opacity-0 group-hover:opacity-100 text-slate-400'}`} />
                      </button>
                    ))}
                  </div>
                )}

                {currentQuestion?.type === 'multiselect' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentQuestion.options?.map((opt) => {
                      const isSelected = Array.isArray(currentValue) && currentValue.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const currentArr = Array.isArray(currentValue) ? currentValue : [];
                            if (isSelected) {
                              setCurrentValue(currentArr.filter(v => v !== opt));
                            } else {
                              setCurrentValue([...currentArr, opt]);
                            }
                          }}
                          className={`p-4 text-left text-lg font-bold rounded-2xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-nyu-violet bg-nyu-violet-bg text-nyu-violet shadow-sm' 
                              : 'border-slate-200 hover:border-nyu-violet/40 hover:bg-nyu-violet-bg/30 text-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion?.type === 'info' && (
                  <div className="flex items-start gap-4 p-6 bg-nyu-violet-bg text-nyu-violet rounded-2xl border border-nyu-violet-accent/50 shadow-sm leading-relaxed">
                    <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-nyu-violet-light" />
                    <div>
                      <p className="font-bold text-sm text-nyu-violet-hover">NYU Strategic Directive Guidance</p>
                      <p className="text-sm mt-1 text-slate-750 font-medium">Please review these compliance guidelines and standard onboarding targets before continuing.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-slate-100">
            <button 
              onClick={handleBack}
              disabled={history.length === 1}
              className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all cursor-pointer ${
                history.length === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-nyu-violet/20'
              }`}
            >
              <ChevronLeft className="w-5 h-5" /> Back
            </button>
            
            {(isGeneralStep || currentQuestion?.type === 'text' || currentQuestion?.type === 'multiselect' || currentQuestion?.type === 'info') && (
              <button 
                onClick={handleNext}
                disabled={!isGeneralStep && currentQuestion?.required && !currentValue}
                className={`flex items-center gap-2 px-8 py-3 font-bold text-white rounded-xl transition-all shadow-lg cursor-pointer ${
                  !isGeneralStep && currentQuestion?.required && !currentValue 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-nyu-violet hover:bg-nyu-violet-hover shadow-nyu-violet/20 focus:outline-none focus:ring-2 focus:ring-nyu-violet focus:ring-offset-2'
                }`}
              >
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);

  return (
    <div className="min-h-screen bg-[#FAF9FC] text-slate-900 font-sans selection:bg-nyu-violet-accent">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-purple-100/40 shadow-sm shadow-purple-950/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-nyu-violet rounded-xl flex items-center justify-center shadow-lg shadow-nyu-violet/20" aria-hidden="true">
                <svg className="w-6 h-6 text-white" viewBox="0 0 100 100" fill="currentColor">
                  {/* Stylized high contrast NYU Torch icon */}
                  <path d="M50,12 C45,28 35,40 45,63 C47,67 53,67 55,63 C65,40 55,28 50,12 Z" />
                  <path d="M42,22 C38,29 30,37 40,52 C41,53 43,53 44,52 C50,37 44,29 42,22 Z" opacity="0.8" fill="#EAD4FA" />
                  <path d="M58,22 C62,29 70,37 60,52 C59,53 57,53 56,52 C50,37 56,29 58,22 Z" opacity="0.8" fill="#EAD4FA" />
                  <path d="M43,62 L57,62 L54,82 L46,82 Z" fill="currentColor" />
                  <rect x="44" y="82" width="12" height="4" rx="1" fill="#FFFFFF" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
                  NYU <span className="text-nyu-violet">IT</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.16em] mt-1">Enterprise Data Management</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setView('user')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                  view === 'user' ? 'bg-white text-nyu-violet shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <User className="w-4 h-4" /> User Portal
              </button>
              <button 
                onClick={() => setView('admin')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                  view === 'admin' ? 'bg-white text-nyu-violet shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Settings className="w-4 h-4" /> Admin Bank
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {view === 'user' ? (
          <UserPortal questions={questions} />
        ) : (
          <AdminPanel questions={questions} setQuestions={setQuestions} />
        )}
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-nyu-violet" />
            <span className="font-medium text-slate-700">Secure NYU IT Data Stewardship</span>
          </div>
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5 text-nyu-violet" />
            <span className="font-medium text-slate-700">Real-time Pipeline Reporting</span>
          </div>
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-nyu-violet" />
            <span className="font-medium text-slate-700">Multi-Tech Academic Integration</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
