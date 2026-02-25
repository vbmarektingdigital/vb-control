import { MessageCircle } from "lucide-react";
import logo from './assets/vb-logo.png';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, LayoutDashboard, Plus, Trash2, Edit2, Check, X, GripVertical, Building2, Tag, MessageSquare, Send, Sparkles, Loader2, Paperclip, Copy } from 'lucide-react';

const GOOGLE_CLIENT_ID = "498011922575-895so7u7j83brjbkaahg7jj5l9o5ql6o.apps.googleusercontent.com";

// IMPORTAÇÃO DO SEU FIREBASE CONFIG
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query } from 'firebase/firestore';

// --- CONSTANTES ---
const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const STATUS_OPTIONS = ['Pendente', 'Em andamento', 'Pronto', 'Finalizado', 'Reedição'];
const STATUS_ORDER = {
  'Reedição': 1,
  'Pronto': 2,
  'Em andamento': 3,
  'Pendente': 4,
  'Finalizado': 5
};
const STATUS_COLORS = {
  'Pendente': 'bg-amber-100 text-amber-800 border-amber-200',
  'Em andamento': 'bg-blue-100 text-blue-800 border-blue-200',
  'Pronto': 'bg-violet-100 text-violet-800 border-violet-200',
  'Finalizado': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Reedição': 'bg-red-600 text-white border-red-600'
};

// --- INTEGRAÇÃO GEMINI API ---
const GEMINI_API_KEY = "AIzaSyCDzdN-qGn7Rfi4vrpTW89tyx1uPZ46L_E"; // Cole sua chave se tiver, ou deixe vazio

async function callGeminiAPI(prompt, systemInstruction) {
  if (!GEMINI_API_KEY) return "Configure sua chave API do Gemini para usar esta função.";
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error('Erro na API');
    
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar.";
  } catch (error) {
    return "Erro ao conectar com a IA.";
  }
}

// --- COMPONENTES AUXILIARES ---
function CommentSection({ comments = [], attachments = [], onUpdateComments, onUpdateAttachments, cardTheme, clientName }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [accessToken, setAccessToken] = useState(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  useEffect(() => {
  const interval = setInterval(() => {
    if (window.google && window.google.accounts && window.gapi) {
      window.gapi.load('client:picker', () => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "https://www.googleapis.com/auth/drive",
          callback: (tokenResponse) => {
            setAccessToken(tokenResponse.access_token);
          }
        });

        window.requestAccessToken = () => {
          tokenClient.requestAccessToken();
        };
      });

      clearInterval(interval);
    }
  }, 300);

  return () => clearInterval(interval);
}, []);

  const handleAddFakeAttachment = () => {
  if (!window.google || !window.google.accounts) return;

  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: (tokenResponse) => {
      if (!tokenResponse.access_token) {
        alert("Erro ao obter token.");
        return;
      }

      const FOLDER_ID = "1NM5p5KHudpS77MvzWVB35vyKautj0hlB";

      const uploadView = new window.google.picker.DocsUploadView()
        .setParent(FOLDER_ID);

      const picker = new window.google.picker.PickerBuilder()
  .addView(window.google.picker.ViewId.DOCS)
  .addView(uploadView)
  .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
  .setOAuthToken(tokenResponse.access_token)
  .setDeveloperKey("AIzaSyCK8OnQIj8cbPXqrhnqogHkH2LQPplDq24")
  .setCallback((data) => {
    if (data.action === window.google.picker.Action.PICKED) {

      const newFiles = data.docs.map(doc => ({
        id: doc.id,
        name: doc.name,
        url: `https://drive.google.com/uc?export=download&id=${doc.id}`,
        type: "file"
      }));

      onUpdateAttachments([...attachments, ...newFiles]);
    }
  })
  .build();

      picker.setVisible(true);
    }
  });

  tokenClient.requestAccessToken();
};

  const handleAddLinkAttachment = () => {
    if (!newLinkUrl.trim()) return;
    
    const linkData = {
      id: crypto.randomUUID(),
      name: newLinkName.trim() || newLinkUrl.trim(),
      url: newLinkUrl.startsWith("http") ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`,
      type: "link"
    };
    
    onUpdateAttachments([...attachments, linkData]);
    setNewLinkName('');
    setNewLinkUrl('');
    setIsLinkModalOpen(false);
  };

  const handleDeleteAttachment = (fileId) => {
    const senha = prompt("Digite a senha para excluir o anexo:");
    if (senha === "123") {
      const updated = attachments.filter(a => a.id !== fileId);
      onUpdateAttachments(updated);
    } else {
      alert("Senha incorreta.");
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const commentData = {
      id: crypto.randomUUID(),
      text: newComment.trim(),
      createdAt: new Date().toISOString()
    };
    
    onUpdateComments([...comments, commentData]);
    setNewComment('');
  };

  const handleDeleteComment = (commentId) => {
    const senha = prompt("Digite a senha para excluir o comentário:");
    if (senha === "123") {
      const updated = comments.filter(c => c.id !== commentId);
      onUpdateComments(updated);
    } else {
      alert("Senha incorreta.");
    }
  };

  const handleCopyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copiado!");
    } catch (err) {
      alert("Não foi possível copiar.");
    }
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex items-center justify-between">
        <button
  onClick={() => setIsExpanded(!isExpanded)}
  className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200
    ${isExpanded
      ? 'bg-slate-100 text-slate-800 shadow-inner scale-[0.98]'
      : 'text-slate-500 hover:bg-slate-50'}
  `}
>
          <MessageSquare size={14} />
          <span>
            <span className={`${comments.length > 0 ? 'text-red-500 font-bold animate-pulse' : ''}`}>
              {comments.length}
            </span>{' '}
            Notas
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
  onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
  className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200
    ${isAttachmentOpen
      ? 'bg-slate-100 text-slate-800 shadow-inner scale-[0.98]'
      : 'text-slate-500 hover:bg-slate-50'}
  `}
>
          <Paperclip size={14} />
          <span>
            <span className={`${attachments.length > 0 ? 'text-blue-600 font-bold animate-pulse' : ''}`}>
              {attachments.length}
            </span>{' '}
            Anexos
          </span>
        </button>
        <a 
          href={`https://wa.me/?text=${encodeURIComponent(`🚨 VB Marketing Gestão\n\nCLIENTE: ${clientName}\nTEMA: ${cardTheme}\n\nHouve atualização e foi solicitada sua atenção.`)}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md hover:bg-green-100 transition"
        >
          WhatsApp
        </a>
      </div>

      {isExpanded && (
        <div className="mt-4">

  <div className="flex items-center gap-2 mb-3">
    <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
    <span className="text-sm font-semibold text-slate-700">
      Notas
    </span>
    <div className="flex-1 h-[2px] bg-slate-200 ml-2 rounded-full"></div>
  </div>

  <div className="space-y-2">

    <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar">
      {comments.length === 0 && (
  <div className="text-xs italic text-slate-400 text-center py-2">
    • nenhuma nota aqui •
  </div>
)}      

      {comments.map((c) => (
        <div key={c.id} className="bg-slate-50 border p-2 rounded-lg text-[11px] flex justify-between items-start">
          <p className="text-slate-700 whitespace-pre-wrap pr-2">{c.text}</p>
          <button onClick={() => handleDeleteComment(c.id)} className="text-red-400 hover:text-red-600 transition">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>

    <div className="flex gap-2">
      <input
        value={newComment}
        onChange={e => setNewComment(e.target.value)}
        placeholder="Adicionar nota..."
        className="flex-1 text-xs border p-1.5 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <button onClick={handleAddComment} className="bg-indigo-600 text-white px-3 rounded-lg">
        +
      </button>
    </div>

  </div>
</div>
)}

{isAttachmentOpen && (
  <div className="mt-6">

    <div className="flex items-center gap-2 mb-3">
      <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
      <span className="text-sm font-semibold text-slate-700">
        Anexos
      </span>
      <div className="flex-1 h-[2px] bg-slate-200 ml-2 rounded-full"></div>
    </div>

    <div className="space-y-2">

      <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar">
        {attachments.length === 0 && (
  <div className="text-xs italic text-slate-400 text-center py-2">
    • nenhum anexo aqui •
  </div>
)}
        {attachments.map((file) => (
          <div
            key={file.id}
            className="bg-slate-50 border p-2 rounded-lg text-[11px] flex justify-between items-center"
          >
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-700 hover:underline truncate pr-2"
            >
              {file.name}
            </a>

            <div className="flex items-center gap-2">
              {file.type === "link" && (
                <button
                  onClick={() => handleCopyLink(file.url)}
                  className="text-slate-500 hover:text-indigo-600 transition"
                  title="Copiar link"
                >
                  <Copy size={14} />
                </button>
              )}

              <button
                onClick={() => handleDeleteAttachment(file.id)}
                className="text-red-400 hover:text-red-600 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddFakeAttachment}
        className="w-full text-xs bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
      >
        Anexar arquivo
      </button>

      <button
        onClick={() => setIsLinkModalOpen(true)}
        className="w-full text-xs bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-800 transition"
      >
        Anexar link
      </button>

      {isLinkModalOpen && (
        <div className="bg-slate-100 p-3 rounded-lg space-y-2">
          <input
            value={newLinkName}
            onChange={e => setNewLinkName(e.target.value)}
            placeholder="Nome do link (opcional)"
            className="w-full text-xs border p-1.5 rounded"
          />
          <input
            value={newLinkUrl}
            onChange={e => setNewLinkUrl(e.target.value)}
            placeholder="Cole o link aqui..."
            className="w-full text-xs border p-1.5 rounded"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsLinkModalOpen(false)}
              className="text-xs px-2 py-1 bg-slate-300 rounded"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddLinkAttachment}
              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

    </div>
  </div>
)}
    </div>
  );
}

function Card({ card, updateCard, deleteCard, onDragStart, onCardDrop }) {
  const [isEditing, setIsEditing] = useState(false);
  const [attachments, setAttachments] = useState(card.attachments || []);
  const [editForm, setEditForm] = useState(card);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setEditForm(card);
  }, [card]);

  useEffect(() => {
    setAttachments(card.attachments || []);
  }, [card]);

  const handleSave = () => {
    updateCard(card.id, {
      ...card, // mantém dados atuais (inclui comments)
      ...editForm // aplica as alterações feitas
    });
    setIsEditing(false);
  };

  const handleAITheme = async () => {
    if (!editForm.clientName) return;
    setIsGenerating(true);
    const res = await callGeminiAPI(`Sugira um tema de campanha para ${editForm.clientName}`, "Máximo 5 palavras.");
    setEditForm({...editForm, theme: res.replace(/["*]/g, '')});
    setIsGenerating(false);
  };

  return (
    <div 
      draggable={!isEditing} 
      onDragStart={(e) => onDragStart(e, card.id)} 
      onDragOver={(e) => e.preventDefault()} 
      onDrop={() => onCardDrop(card.id)} 
      className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group relative"
    >
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isEditing && (
          <>
            <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-blue-50 text-blue-500 rounded"><Edit2 size={14}/></button>
            <button onClick={() => deleteCard(card.id)} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14}/></button>
          </>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Cliente e Data:</span>
            <input 
              value={editForm.clientName} 
              onChange={e => setEditForm({...editForm, clientName: e.target.value})} 
              className="w-full text-sm border p-2 rounded-lg" 
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Tema:</span>
            <input 
              value={editForm.theme} 
              onChange={e => setEditForm({...editForm, theme: e.target.value})} 
              className="w-full text-sm border p-2 rounded-lg" 
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Status:</span>
            <select 
              value={editForm.status} 
              onChange={e => setEditForm({...editForm, status: e.target.value})} 
              className="w-full text-xs border p-2 rounded-lg"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Flag:</span>
            <select 
              value={editForm.priority || 'Normal'} 
              onChange={e => setEditForm({...editForm, priority: e.target.value})} 
              className="w-full text-xs border p-2 rounded-lg"
            >
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsEditing(false)} className="text-xs px-2 py-1 bg-slate-100 rounded">Cancelar</button>
            <button onClick={handleSave} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">Salvar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2">
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${STATUS_COLORS[card.status]}`}>{card.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <GripVertical size={16} className="opacity-30 group-hover:opacity-70 cursor-pointer active:cursor-grabbing transition text-slate-400 hover:text-slate-700" />
            {card.priority === 'Alta' && (
              <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full"></span>
            )}
            {card.priority === 'Urgente' && (
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
            )}
            <h3 className="font-bold text-sm text-slate-800">
              {card.clientName || 'Novo Cliente'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {card.theme || 'Sem tema definido'}
          </p>
          <CommentSection 
            comments={card.comments} 
            attachments={attachments} 
            onUpdateComments={(newList) => updateCard(card.id, {...card, comments: newList})} 
            onUpdateAttachments={(newList) => {
              setAttachments(newList);
              updateCard(card.id, {...card, attachments: newList});
            }} 
            cardTheme={card.theme} 
            clientName={card.clientName} 
          />
        </>
      )}
    </div>
  );
}

// --- APP PRINCIPAL ---
export default function App() {
  const [cards, setCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todos');
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [baseDate, setBaseDate] = useState(new Date());

  function getWeekIdFromDate(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  }

  function getWeekDateRange(date) {
    const start = new Date(date);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  const weekId = getWeekIdFromDate(baseDate);
  const { start, end } = getWeekDateRange(baseDate);
  const currentWeekId = getWeekIdFromDate(new Date());
  const isCurrentWeek = weekId === currentWeekId;
  const todayIndex = (new Date().getDay() + 6) % 7;

  const goToPreviousWeek = () => {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() - 7);
    setBaseDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + 7);
    setBaseDate(newDate);
  };

  const goToCurrentWeek = () => {
    setBaseDate(new Date());
  };

  useEffect(() => {
    if (!db) return;
    const q = collection(db, 'weeks', weekId, 'cards');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCards(loaded);
    });
    return () => unsubscribe();
  }, [weekId]);

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const matchSearch = card.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || card.theme?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'Todos' || card.status === statusFilter;
      const matchPriority = priorityFilter === 'Todos' || card.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [cards, searchTerm, statusFilter, priorityFilter]);

  const addCard = async (columnId) => {
    const id = crypto.randomUUID();
    const cardsDaColuna = cards.filter(c => c.columnId === columnId);
    const nextOrder = cardsDaColuna.length;
    const newCard = {
      columnId,
      clientName: 'Novo Cliente',
      theme: '',
      status: 'Pendente',
      comments: [],
      attachments: [],
      order: nextOrder,
      priority: 'Normal'
    };
    await setDoc(doc(db, 'weeks', weekId, 'cards', id), newCard);
  };

  const updateCard = async (id, updatedData) => {
    const { id: _, ...dataToSave } = updatedData;
    await updateDoc(doc(db, 'weeks', weekId, 'cards', id), dataToSave);
  };

  const deleteCard = async (id) => {
    if (window.confirm('Excluir este card?')) {
      await deleteDoc(doc(db, 'weeks', weekId, 'cards', id));
    }
  };

  // 🔥 APAGAR TODOS OS CARDS DA COLUNA
  const deleteAllCardsInColumn = async (columnId) => {
    const senha = prompt("Digite a senha para excluir todos os cards:");
    if (senha !== "123") {
      alert("Senha incorreta.");
      return;
    }
    const cardsToDelete = cards.filter(c => c.columnId === columnId);
    for (let c of cardsToDelete) {
      await deleteDoc(doc(db, 'weeks', weekId, 'cards', c.id));
    }
    alert(`Todos os cards da coluna "${columnId}" foram excluídos.`);
  };

  const handleDrop = async (columnId) => {
    if (draggedCardId) {
      await updateDoc(doc(db, 'weeks', weekId, 'cards', draggedCardId), { columnId });
    }
    setDraggedCardId(null);
  };

  const handleReorder = async (targetCardId) => {
    if (!draggedCardId) return;
    const dragged = cards.find(c => c.id === draggedCardId);
    const target = cards.find(c => c.id === targetCardId);
    
    if (!dragged || !target) return;
    if (dragged.columnId !== target.columnId) return;
    
    const colunaCards = cards
      .filter(c => c.columnId === dragged.columnId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
    const newOrder = [...colunaCards];
    const draggedIndex = newOrder.findIndex(c => c.id === dragged.id);
    const targetIndex = newOrder.findIndex(c => c.id === target.id);
    
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);
    
    for (let i = 0; i < newOrder.length; i++) {
      await updateDoc(doc(db, 'weeks', weekId, 'cards', newOrder[i].id), { order: i });
    }
    setDraggedCardId(null);
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-[#2b2b2b] overflow-hidden">
      <header className="relative bg-[#2b2b2b] border-b border-[#3a3a3a] px-4 py-4 shadow-sm z-10">
  {/* Linha amarela superior */}
  <div className="absolute top-0 left-0 w-full h-[3px] bg-[#f9a705]"></div>

  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 relative">
    
    {/* Bloco 1: Logo e Texto */}
    <div className="flex items-center gap-3 text-left w-full md:w-auto">
      <img src={logo} alt="VB Marketing Digital" className="className=w-14 h-14 object-contain shrink-0" />
      <div>
        <h1 className="text-lg font-extrabold text-white">
          VB Marketing Digital
        </h1>
        <p className="text-xs text-slate-100 font-medium mt-1">
          VB Control | Gestão Semanal
        </p>
      </div>
    </div>

    {/* Bloco 2: DATA (Reduzido e compactado para caber no celular sem barra de rolagem) */}
    <div className="bg-[#1f1f1f] rounded-xl px-3 py-2 md:px-5 md:py-3 flex items-center justify-center gap-2 md:gap-4 shadow-lg md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 whitespace-nowrap mx-auto w-[max-content] md:w-auto">

      <button
        onClick={goToPreviousWeek}
        className="px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-white bg-[#4f39f6] hover:bg-[#3f2de0] rounded-lg transition shrink-0"
      >
        ←
      </button>

      <div className="text-xs md:text-sm text-white font-medium whitespace-nowrap">
        <span className="font-bold text-[#f9a705]">
          {start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        </span>
        {' '}a{' '}
        <span className="font-bold text-[#f9a705]">
          {end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        </span>
        {' '}de{' '}
        <span className="font-semibold">
          {start.getFullYear()}
        </span>
      </div>

      <button
        onClick={goToNextWeek}
        className="px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-white bg-[#4f39f6] hover:bg-[#3f2de0] rounded-lg transition shrink-0"
      >
        →
      </button>

      <button
        onClick={goToCurrentWeek}
        className="px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm font-semibold bg-[#f9a705] text-black rounded-lg hover:opacity-90 transition shrink-0"
      >
        Hoje
      </button>

    </div>

    {/* Bloco 3: FILTROS */}
    <div className="flex gap-2 w-full md:w-auto">
      <input 
        placeholder="Buscar" 
        value={searchTerm} 
        onChange={e => setSearchTerm(e.target.value)} 
        className="w-28 md:flex-1 text-xs md:text-sm border border-black/20 rounded-lg px-2 py-1 bg-white" 
      />
      <select 
        value={statusFilter} 
        onChange={e => setStatusFilter(e.target.value)} 
        className="text-xs md:text-sm border border-black/20 rounded-lg px-2 py-1 bg-white"
      >
        <option value="Todos" disabled>Status</option>
        <option value="Todos">Todos</option>
        <option value="Pendente">Pendente</option>
        <option value="Em andamento">Em andamento</option>
        <option value="Pronto">Pronto</option>
        <option value="Finalizado">Finalizado</option>
        <option value="Reedição">Reedição</option>
      </select>
      <select 
        value={priorityFilter} 
        onChange={e => setPriorityFilter(e.target.value)} 
        className="text-xs md:text-sm border border-black/20 rounded-lg px-2 py-1 bg-white"
      >
        <option value="Todos">Flag</option>
        <option value="Normal">Normal</option>
        <option value="Alta">Alta</option>
        <option value="Urgente">Urgente</option>
      </select>
    </div>

  </div>
</header>

      <main className="flex-1 overflow-x-auto p-6 flex gap-6 custom-scrollbar">
        {DIAS_SEMANA.map((dia, index) => (
          <div 
            key={dia} 
            onDragOver={e => e.preventDefault()} 
            onDrop={() => handleDrop(dia)} 
            className="w-80 shrink-0 flex flex-col bg-[#5f5f5f] rounded-2xl border border-[#4f4f4f]"
          >
            <div className="p-4 flex justify-between items-center">
              <div className="flex flex-col">
                <h2 className="font-bold text-white">{dia}</h2>
                {isCurrentWeek && index === todayIndex && (
                  <div className="h-1 w-20 bg-green-500 rounded-full mt-1"></div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => deleteAllCardsInColumn(dia)} 
                  className="text-red-500 hover:text-red-700 hover:scale-110 active:scale-95 transition" 
                  title="Apagar todos os cards deste dia"
                >
                  <Trash2 size={16} />
                </button>
                <span className="bg-[#f9a705] text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {filteredCards.filter(c => c.columnId === dia).length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-3 space-y-3 min-h-[100px] custom-scrollbar">
              {filteredCards
                .filter(c => c.columnId === dia)
                .sort((a, b) => {
  const statusA = STATUS_ORDER[a.status] ?? 99;
  const statusB = STATUS_ORDER[b.status] ?? 99;

  if (statusA !== statusB) {
    return statusA - statusB;
  }

  return (a.order ?? 0) - (b.order ?? 0);
})
                .map(card => (
                  <Card 
                    key={card.id} 
                    card={card} 
                    updateCard={updateCard} 
                    deleteCard={deleteCard} 
                    onDragStart={(e, id) => setDraggedCardId(id)} 
                    onCardDrop={(targetId) => handleReorder(targetId)} 
                  />
                ))}
            </div>
            
            <button 
              onClick={() => addCard(dia)} 
              className="m-3 py-2.5 text-xs font-bold text-white bg-[#4f39f6] hover:bg-[#3f2de0] hover:scale-[1.02] active:scale-[0.98] rounded-xl transition-all shadow-lg shadow-[#4f39f6]/40"
            >
              + NOVO CARD
            </button>
          </div>
        ))}
      </main>

      <style dangerouslySetInnerHTML={{ 
        __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; } 
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ` 
      }} />
    </div>
  );
}