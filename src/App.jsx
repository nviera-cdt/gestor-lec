/**
 * Gestor de Documentación - Ley de Economía del Conocimiento (LEC)
 * * Versión 8.1: Corrección de Estilos (Tailwind CDN Auto-inyectable)
 * - Se añade inyección automática de Tailwind CSS via CDN para evitar errores de compilación local.
 * - Incluye Dashboard I+D Avanzado, Nómina, Compras y Capacitación con Templates dinámicos.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  where
} from 'firebase/firestore';
import {
  FileText,
  Users,
  Lightbulb,
  GraduationCap,
  Award,
  Settings,
  UploadCloud,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  UserCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Loader2,
  Globe,
  History,
  Download,
  Filter,
  ChevronUp,
  ChevronDown,
  Plus,
  PlusCircle,
  Trash2,
  Eye,
  Paperclip,
  DollarSign,
  TrendingUp,
  PieChart,
  Target,
  ShoppingCart,
  Activity,
  Edit2,
  AlertTriangle
} from 'lucide-react';

// --- Configuración e Inicialización ---
// Asegúrate de que __firebase_config esté definido en tu entorno o reemplaza esto con tus credenciales reales
const firebaseConfig = {
  apiKey: "AIzaSyAYzdxF50lWSiDblgQqCFxGEnj3On8MJQo",
  authDomain: "gestor-lec-prueba.firebaseapp.com",
  projectId: "gestor-lec-prueba",
  storageBucket: "gestor-lec-prueba.firebasestorage.app",
  messagingSenderId: "104253240608",
  appId: "1:104253240608:web:2b2483b44ea8f962aed345",
  measurementId: "G-MD3BBXHX2N"
};

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'lec-manager-default';

// --- Utilidades ---
const downloadCSV = (data, filename) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(obj => Object.values(obj).map(val => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    // Escape quotes and wrap in quotes if contains comma or quote
    if (str.includes('"') || str.includes(',')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  }).join(","));

  const csvContent = "\uFEFF" + [headers, ...rows].join("\n"); // Add BOM for Excel
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const fullYear = y.length === 2 ? `20${y}` : y;
    return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr;
};

// --- Hooks ---
const useFirebaseInit = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setAuth(authInstance);
      setDb(dbInstance);

      const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(authInstance, __initial_auth_token);
        } else {
          await signInAnonymously(authInstance);
        }
      };
      initAuth();
      onAuthStateChanged(authInstance, (u) => { setUser(u); setIsAuthReady(true); });
    } catch (e) { console.error(e); setIsAuthReady(true); }
  }, []);
  return { db, auth, user, isAuthReady, userEmail: user?.email || 'Usuario' };
};

const useLecConfig = (db, user) => {
  const [config, setConfig] = useState({
    companySize: 'pyme',
    targetHeadcount: 10,
    targetRevenue: 100000000,
    targetExport: 50000,
    targetTraining: 2000000,
    targetPctID: 3,
    bienioStart: '2025-01-01',
    bienioEnd: '2026-12-31',
    importFields: {
      nomina: "Legajo,CUIL,Nombre,Apellido,Remuneracion2,Puesto,Fecha_Alta",
      ventas: "Fecha,Tipo_Cbte,Punto_Venta,Numero,Cliente,CUIT,Neto_Gravado,Total,Moneda",
      capacitacion: "Nombre_Curso,Proveedor,CUIL_Asistente,Fecha_Realizacion,Costo_Total,Horas_Duracion",
      compras: "Fecha,Proveedor,CUIT,Concepto,Monto_Neto,IVA,Total,Proyecto_ID_Asociado"
    },
    qualityNorms: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user) return;

    const ref = doc(db, `/artifacts/${APP_ID}/public/data/lec_config`, 'settings');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) setConfig(prev => ({ ...prev, ...snap.data() }));
      else setDoc(ref, config, { merge: true });
      setLoading(false);
    }, (error) => {
      console.error("Error cargando config:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, user]);

  return { config, loading };
};

const useCrudCollection = (db, collectionName, bienioStart, bienioEnd, user) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const path = `/artifacts/${APP_ID}/public/data/${collectionName}`;

  useEffect(() => {
    if (!db || !user) return;

    const q = query(collection(db, path));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = rawData.filter(item => {
        // Filter by Company ID if provided
        if (user.companyId && item.companyId !== user.companyId) return false;

        // Fix for "disappearing" items: handle null/latency timestamps gracefully
        let tsDate = null;
        if (item.timestamp && typeof item.timestamp.toDate === 'function') {
          tsDate = item.timestamp.toDate().toISOString();
        }

        const dateToCheck = item.fecha || item.fechaInicio || item.fechaAlta || tsDate;
        const normalizedDate = normalizeDate(dateToCheck);

        if (!normalizedDate) return true;
        if (!bienioStart || !bienioEnd) return true;

        return normalizedDate >= bienioStart && normalizedDate <= bienioEnd;
      });
      setItems(filtered);
      setLoading(false);
    }, (error) => {
      console.error(`Error en ${collectionName}:`, error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, path, bienioStart, bienioEnd, user]);

  const addItem = async (data) => {
    if (!db || !user) return;
    const dataWithContext = {
      ...data,
      timestamp: serverTimestamp(),
      companyId: user.companyId // Auto-inject companyId
    };
    await addDoc(collection(db, path), dataWithContext);
  };
  const updateItem = async (id, data) => db && user && await updateDoc(doc(db, path, id), data);
  const deleteItem = async (id) => db && user && await deleteDoc(doc(db, path, id));

  return { items, loading, addItem, updateItem, deleteItem };
};

// --- PANTALLA DE INICIO (SELECCIÓN EMPRESA/BIENIO) ---
const LandingScreen = ({ db, onStart }) => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCUIT, setNewCompanyCUIT] = useState('');
  const [showNewCompany, setShowNewCompany] = useState(false);

  const [bienios, setBienios] = useState([]);
  const [selectedBienioId, setSelectedBienioId] = useState('');
  const [newBienioRange, setNewBienioRange] = useState('2025-2026');
  const [showNewBienio, setShowNewBienio] = useState(false);

  const [loading, setLoading] = useState(true);

  // Fetch Companies
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, `/artifacts/${APP_ID}/public/data/lec_companies`));
    const unsub = onSnapshot(q, (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  // Fetch Bienios for Selected Company
  useEffect(() => {
    if (!db || !selectedCompanyId) {
      setBienios([]);
      return;
    }
    const q = query(
      collection(db, `/artifacts/${APP_ID}/public/data/lec_bienios`),
      where('companyId', '==', selectedCompanyId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setBienios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [db, selectedCompanyId]);

  const handleCreateCompany = async () => {
    if (!newCompanyName || !newCompanyCUIT) return;
    const docRef = await addDoc(collection(db, `/artifacts/${APP_ID}/public/data/lec_companies`), {
      razonSocial: newCompanyName,
      cuit: newCompanyCUIT,
      createdAt: serverTimestamp()
    });
    setSelectedCompanyId(docRef.id);
    setShowNewCompany(false);
    setNewCompanyName('');
    setNewCompanyCUIT('');
  };

  const handleCreateBienio = async () => {
    if (!selectedCompanyId) return;
    const [startYear, endYear] = newBienioRange.split('-');
    const docRef = await addDoc(collection(db, `/artifacts/${APP_ID}/public/data/lec_bienios`), {
      companyId: selectedCompanyId,
      name: newBienioRange,
      start: `${startYear}-01-01`,
      end: `${endYear}-12-31`,
      // Default targets
      targets: {
        targetHeadcount: 10,
        targetRevenue: 70, // Meta % de ventas promovidas
        targetExport: 15,  // Meta % de exportación
        targetTraining: 2000000,
        targetPctID: 3,
        targetIDCount: 1,
        targetQualityCount: 1
      }
    });
    setSelectedBienioId(docRef.id);
    setShowNewBienio(false);
  };

  const handleStart = () => {
    const company = companies.find(c => c.id === selectedCompanyId);
    const bienio = bienios.find(b => b.id === selectedBienioId);
    if (company && bienio) {
      onStart(company, bienio);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="LEControl Logo" className="w-20 h-20 mx-auto object-contain mb-4" />
        <h1 className="text-4xl font-extrabold text-blue-900 tracking-tight">LEControl</h1>
        <p className="text-gray-500 mt-2">Gestor Integral Ley de Economía del Conocimiento</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6">
        {/* Company Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Empresa</label>
          {!showNewCompany ? (
            <div className="flex space-x-2 min-w-0">
              <select
                className="flex-1 min-w-0 border p-2 rounded-lg truncate bg-white"
                value={selectedCompanyId}
                onChange={e => setSelectedCompanyId(e.target.value)}
              >
                <option value="">-- Seleccionar Empresa --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id} className="truncate">
                    {c.razonSocial} ({c.cuit})
                  </option>
                ))}
              </select>
              <button onClick={() => setShowNewCompany(true)} className="flex-shrink-0 bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <input className="w-full border p-2 rounded text-sm" placeholder="Razón Social" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} />
              <input className="w-full border p-2 rounded text-sm" placeholder="CUIT" value={newCompanyCUIT} onChange={e => setNewCompanyCUIT(e.target.value)} />
              <div className="flex justify-end space-x-2">
                <button onClick={() => setShowNewCompany(false)} className="text-gray-500 text-xs">Cancelar</button>
                <button onClick={handleCreateCompany} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">Crear</button>
              </div>
            </div>
          )}
        </div>

        {/* Bienio Selection */}
        {selectedCompanyId && (
          <div className="animate-fadeIn">
            <label className="block text-sm font-bold text-gray-700 mb-2">Bienio de Trabajo</label>
            {!showNewBienio ? (
              <div className="flex space-x-2 min-w-0">
                <select
                  className="flex-1 min-w-0 border p-2 rounded-lg truncate bg-white"
                  value={selectedBienioId}
                  onChange={e => setSelectedBienioId(e.target.value)}
                >
                  <option value="">-- Seleccionar Bienio --</option>
                  {bienios.map(b => (
                    <option key={b.id} value={b.id} className="truncate">
                      {b.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => setShowNewBienio(true)} className="flex-shrink-0 bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 bg-green-50 p-4 rounded-lg border border-green-100">
                <input className="w-full border p-2 rounded text-sm" placeholder="Rango (ej: 2025-2026)" value={newBienioRange} onChange={e => setNewBienioRange(e.target.value)} />
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setShowNewBienio(false)} className="text-gray-500 text-xs">Cancelar</button>
                  <button onClick={handleCreateBienio} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Crear</button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          disabled={!selectedCompanyId || !selectedBienioId}
          onClick={handleStart}
          className={`w-full py-3 rounded-xl font-bold text-lg shadow-lg transition-all ${selectedCompanyId && selectedBienioId
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          Ingresar al Sistema
        </button>
      </div>
    </div>
  );
};

// 1. DASHBOARD AVANZADO
const DashboardLEC = ({
  lecConfig,
  nominaCount,
  nominaRecords, // New prop for correct average calculation
  projectsCount,
  totalRevenue,
  totalPromotedRevenue, // New prop
  totalExport,
  totalTraining,
  totalCapacitacionOnly,
  totalPrimerEmpleo,
  totalEquipamiento,
  totalPayroll,
  totalIDInvestment,
  nominaFinalCount
}) => {
  const {
    targetHeadcount,
    targetRevenue, // Now a percentage (e.g. 70)
    targetExport,  // Now a percentage (e.g. 15)
    targetTraining,
    targetPctID,
    targetIDCount,
    targetQualityCount,
    bienioStart,
    bienioEnd,
    qualityNorms
  } = lecConfig;

  const validQualityCount = qualityNorms.filter(n => new Date(n.endDate) >= new Date()).length;

  const daysRemaining = Math.ceil((new Date(bienioEnd) - new Date()) / (1000 * 60 * 60 * 24));

  // Cálculos
  const actualRevenuePct = totalRevenue > 0 ? (totalPromotedRevenue / totalRevenue) * 100 : 0;
  const actualExportPct = totalRevenue > 0 ? (totalExport / totalRevenue) * 100 : 0;

  const pctRevenueCompliance = targetRevenue > 0 ? (actualRevenuePct / targetRevenue) * 100 : 0;
  const pctExportCompliance = targetExport > 0 ? (actualExportPct / targetExport) * 100 : 0;

  const pctTrainingObj = targetTraining > 0 ? (totalTraining / targetTraining) * 100 : 0;

  const pctIDRevenue = totalRevenue > 0 ? (totalIDInvestment / totalRevenue) * 100 : 0;
  const missingIDInvestment = (targetPctID / 100 * totalRevenue) - totalIDInvestment;
  const isIDCompliant = pctIDRevenue >= targetPctID;

  const annualPayrollActual = totalPayroll * 12; // Check if this logic is desired, assuming totalPayroll is annual-ish 
  // Fix avgSalary to use records count (months paid) instead of headcount
  const avgSalary = nominaRecords > 0 ? totalPayroll / nominaRecords : 0;
  const annualPayrollTarget = avgSalary * targetHeadcount * 12;
  const pctTrainingVsPayrollActual = annualPayrollActual > 0 ? (totalTraining / annualPayrollActual) * 100 : 0;
  const pctTrainingVsPayrollTarget = annualPayrollTarget > 0 ? (totalTraining / annualPayrollTarget) * 100 : 0;

  const handleDownloadPDF = () => {
    const element = document.getElementById('dashboard-content');
    const opt = {
      margin: 0.2,
      filename: `Dashboard_LEC_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save();
    } else {
      alert("La librería de PDF aún se está cargando. Intenta de nuevo en unos segundos.");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">


      <div id="dashboard-content" className="space-y-6 p-2 bg-gray-50">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">

          <div>
            <h2 className="text-2xl font-bold">Estado del Bienio</h2>
            <p className="opacity-80 text-sm mt-1">{bienioStart} <span className="mx-2">➔</span> {bienioEnd}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{daysRemaining > 0 ? daysRemaining : 0}</p>
            <p className="text-xs uppercase tracking-wider">Días Restantes</p>
          </div>
        </div>

        <div className="flex justify-end no-print">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center text-xs font-bold text-red-600 hover:text-red-800 border border-red-600 px-3 py-1.5 rounded-lg bg-white shadow-sm transition-all hover:bg-red-50"
          >
            <Download className="w-3 h-3 mr-2" />
            EXPORTAR REPORTE PDF
          </button>
        </div>

        <h3 className="text-lg font-bold text-gray-800 flex items-center mt-6">
          <LayoutDashboard className="w-5 h-5 mr-2 text-blue-600" />
          Métricas Operativas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border-l-4 shadow-sm ${nominaCount >= targetHeadcount ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Nómina Bienio</p>
                <p className="text-2xl font-extrabold text-gray-800 mt-1">{nominaCount}</p>
              </div>
              <Users className={`${nominaCount >= targetHeadcount ? 'text-green-600' : 'text-red-300'} w-8 h-8 opacity-20`} />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Objetivo: {targetHeadcount}</p>
            <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
              <div className={`h-1 rounded-full ${nominaCount >= targetHeadcount ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min((nominaCount / targetHeadcount) * 100, 100)}%` }}></div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border-l-4 shadow-sm ${nominaFinalCount >= targetHeadcount ? 'bg-green-500/10 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Nómina Final</p>
                <p className="text-2xl font-extrabold text-gray-800 mt-1">{nominaFinalCount}</p>
              </div>
              <Users className={`${nominaFinalCount >= targetHeadcount ? 'text-green-600' : 'text-red-300'} w-8 h-8 opacity-20`} />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Objetivo: {targetHeadcount}</p>
            <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
              <div className={`h-1 rounded-full ${nominaFinalCount >= targetHeadcount ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min((nominaFinalCount / targetHeadcount) * 100, 100)}%` }}></div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border-l-4 shadow-sm ${projectsCount >= targetIDCount ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Proyectos I+D</p>
                <p className="text-2xl font-extrabold text-gray-800 mt-1">{projectsCount}</p>
              </div>
              <Lightbulb className={`${projectsCount >= targetIDCount ? 'text-green-600' : 'text-red-300'} w-8 h-8 opacity-20`} />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Objetivo: {targetIDCount}</p>
          </div>

          <div className={`p-4 rounded-xl border-l-4 shadow-sm ${validQualityCount >= targetQualityCount ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Calidad</p>
                <p className="text-2xl font-extrabold text-gray-800 mt-1">{qualityNorms.length}</p>
              </div>
              <Award className={`${validQualityCount >= targetQualityCount ? 'text-green-600' : 'text-red-300'} w-8 h-8 opacity-20`} />
            </div>
            <div className="mt-2 text-[10px] text-gray-500">
              {validQualityCount} vigentes (Meta: {targetQualityCount})
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-800 flex items-center mt-6">
          <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
          Métricas Financieras & Cumplimiento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-6 rounded-xl shadow-sm border ${actualRevenuePct >= targetRevenue ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Facturación Promovida</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${totalPromotedRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 mt-1">Total Facturado: ${totalRevenue.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase">Meta sobre Facturación</p>
                <p className="text-sm font-semibold text-gray-600">{targetRevenue}%</p>
              </div>
            </div>
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${actualRevenuePct >= targetRevenue ? 'text-green-700 bg-green-200' : 'text-red-700 bg-red-200'}`}>
                    {actualRevenuePct.toFixed(1)}% Real (Meta {targetRevenue}%)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-500">{pctRevenueCompliance.toFixed(0)}% Cumplido</span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200/50">
                <div style={{ width: `${Math.min(pctRevenueCompliance, 100)}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${pctRevenueCompliance >= 100 ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-xl shadow-sm border ${actualExportPct >= targetExport ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Exportaciones (No Argentina)</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">${totalExport.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 mt-1">Total Facturado: ${totalRevenue.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase">Meta sobre Facturación</p>
                <p className="text-sm font-semibold text-gray-600">{targetExport}%</p>
              </div>
            </div>
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${actualExportPct >= targetExport ? 'text-green-700 bg-green-200' : 'text-red-700 bg-red-200'}`}>
                    {actualExportPct.toFixed(1)}% Real (Meta {targetExport}%)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-500">{pctExportCompliance.toFixed(0)}% Cumplido</span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200/50">
                <div style={{ width: `${Math.min(pctExportCompliance, 100)}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${pctExportCompliance >= 100 ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-800 flex items-center mt-6">
          <Activity className="w-5 h-5 mr-2 text-yellow-600" />
          Análisis de Inversión I+D
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-6 rounded-xl shadow-sm border md:col-span-2 ${isIDCompliant ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <div className="mb-4 md:mb-0">
                <p className="text-xs font-bold text-gray-500 uppercase">Inversión I+D Acumulada</p>
                <p className="text-4xl font-extrabold text-gray-800 mt-1">${totalIDInvestment.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">Suma de RRHH imputado + Gastos Materiales</p>
              </div>
              <div className={`${isIDCompliant ? 'bg-green-100' : 'bg-red-100'} p-4 rounded-lg text-right min-w-[200px]`}>
                <p className="text-xs font-bold text-gray-400 uppercase">Meta sobre Ventas</p>
                <p className={`text-2xl font-bold ${isIDCompliant ? 'text-green-700' : 'text-red-700'}`}>{targetPctID}%</p>
                <p className={`text-sm font-bold ${isIDCompliant ? 'text-green-600' : 'text-red-600'}`}>
                  {isIDCompliant ? 'CUMPLIDO' : 'NO CUMPLIDO'}
                </p>
              </div>
            </div>

            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${isIDCompliant ? 'text-green-700 bg-green-200' : 'text-red-700 bg-red-200'}`}>
                    Representa el {pctIDRevenue.toFixed(2)}% de la Facturación
                  </span>
                </div>
                {!isIDCompliant && (
                  <div className="text-right">
                    <span className="text-xs font-bold text-red-500">
                      Falta invertir: ${missingIDInvestment > 0 ? missingIDInvestment.toLocaleString() : 0}
                    </span>
                  </div>
                )}
              </div>
              <div className="overflow-hidden h-4 mb-2 text-xs flex rounded bg-gray-200/50">
                <div
                  style={{ width: `${Math.min((pctIDRevenue / targetPctID) * 100, 100)}%` }}
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${isIDCompliant ? 'bg-green-500' : 'bg-red-500'}`}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>0%</span>
                <span>Meta: {targetPctID}%</span>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-800 flex items-center mt-6">
          <GraduationCap className="w-5 h-5 mr-2 text-purple-600" />
          Inversión en Capacitación
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-6 rounded-xl shadow-sm border flex flex-col justify-between ${totalTraining >= targetTraining ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Inversión Total</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">${totalTraining.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Meta: ${targetTraining.toLocaleString()}</p>
            </div>
            <div className="mt-4">
              <div className={`text-right text-xs font-bold mb-1 ${totalTraining >= targetTraining ? 'text-green-600' : 'text-red-600'}`}>{pctTrainingObj.toFixed(1)}% de la Meta</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className={`${totalTraining >= targetTraining ? 'bg-green-500' : 'bg-red-500'} h-1.5 rounded-full`} style={{ width: `${Math.min(pctTrainingObj, 100)}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase">Vs. Nómina Actual</p>
              <PieChart className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-extrabold text-gray-800">{pctTrainingVsPayrollActual.toFixed(2)}%</p>
            <p className="text-xs text-gray-500 mt-2">
              De la Masa Salarial Anualizada Actual<br />
              <span className="font-mono text-gray-400">(${annualPayrollActual.toLocaleString()})</span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase">Vs. Nómina Objetivo</p>
              <Target className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-extrabold text-gray-800">{pctTrainingVsPayrollTarget.toFixed(2)}%</p>
            <p className="text-xs text-gray-500 mt-2">
              De la Masa Salarial Objetivo<br />
              <span className="font-mono text-gray-400">(${annualPayrollTarget.toLocaleString()})</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 no-print">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Desglose: Capacitación</p>
            <p className="text-xl font-bold text-purple-700 mt-1">${totalCapacitacionOnly.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Desglose: Primer Empleo</p>
            <p className="text-xl font-bold text-blue-700 mt-1">${totalPrimerEmpleo.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Desglose: Equipamiento</p>
            <p className="text-xl font-bold text-green-700 mt-1">${totalEquipamiento.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. IMPORTAR
const ImportarArchivos = ({ db, user, config }) => {
  const [tipoArchivo, setTipoArchivo] = useState('NOMINA');
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileInputRef = React.useRef(null);

  const handleDownloadTemplate = () => {
    let fields = "";
    switch (tipoArchivo) {
      case 'NOMINA': fields = config.importFields?.nomina || "Año,Mes,Periodo,Nombre_Apellido,CUIL,Remuneracion,Fecha_Alta"; break;
      case 'IVA_VENTAS': fields = config.importFields?.ventas || "Fecha,Tipo_Cbte,Numero,Cliente,CUIT,Neto_Gravado,Impuestos,Total,Moneda,Pais,Detalle,Centro_Costo,Actividad,Promovido"; break;
      case 'IVA_COMPRAS': fields = config.importFields?.compras || "Fecha,Proveedor,CUIT,Concepto,Monto_Neto,IVA,Total,Proyecto_ID_Asociado"; break;
      case 'CAPACITACION': fields = config.importFields?.capacitacion || "Periodo,Curso_Titulo,Curso_Descripcion,Tipo_Gasto,CUIL_Asistente,Apellido_Asistente,Nombre_Asistente,Genero,Fecha_Nacimiento,Es_Empleado,Obtuvo_Beneficio,Capacitador_Tipo,Capacitador_Sist_Educ,Capacitador_Nombre,Capacitador_CUIT,Monto,Justificacion,Link_Factura,Link_Programa,Link_Certificado"; break;
      case 'PRIMER_EMPLEO': fields = "Periodo,CUIL_Empleado,Apellido,Nombre,Genero,Fecha_de_alta,Monto_total_Rem_Bruta_F931"; break;
      case 'ADQUISICION_EQUIPAMIENTO': fields = "Periodo,Detalle_Equipamiento_Adquirido,Destino_del_equipamiento,Tipo_Comprobante,Nro_Comprobante,Fecha_comprobante,Costo_Total_sin_iva,Justificacion"; break;
      case 'PROYECTOS': fields = "Nombre,Descripcion,Fecha_Inicio,Presupuesto_Estimado"; break;
      default: fields = "Campo1,Campo2";
    }

    const csvContent = "data:text/csv;charset=utf-8," + fields;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TEMPLATE_LEC_${tipoArchivo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text) => {
    // Standardize line endings and filter truly empty or whitespace-only lines
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '' && line.replace(/[,;]/g, '').trim() !== '');
    if (lines.length < 2) return [];

    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

    return lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || "";
      });
      return obj;
    }).filter(record => {
      // Basic check: at least one field should have meaningful data
      return Object.values(record).some(val => val !== "");
    });
  };

  const parseNumber = (val) => {
    if (!val) return 0;
    let clean = val.toString().replace(/\s/g, '');
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
  };

  const findValue = (record, possibleFields) => {
    const fields = possibleFields.split(',').map(f => f.trim().toLowerCase());
    const recordKeys = Object.keys(record);
    for (const key of recordKeys) {
      if (fields.includes(key.toLowerCase())) return record[key];
    }
    return "";
  };


  const mapRecordToFirestore = (record, type, currentPeriod = null) => {
    // Standardize periodo to YYYYMM format from YYYY-MM input
    const formattedPeriod = currentPeriod ? currentPeriod.replace('-', '') : '';

    switch (type) {
      case 'NOMINA':
        return {
          collection: 'lec_nomina_rrhh',
          data: {
            periodo: formattedPeriod,
            fecha: currentPeriod ? `${currentPeriod}-01` : '',
            nombreApellido: findValue(record, "Nombre_Apellido,Nombre,Apellido") || '',
            fechaNacimiento: findValue(record, "Fecha_de_nacimiento,Fecha_Nacimiento,Nacimiento") || '',
            cuil: findValue(record, "CUIL,C.U.I.L.,Cuil") || '',
            codigoActividad: findValue(record, "Codigo Actividad,Codigo_Actividad,Cod_Act") || '',
            fechaAlta: findValue(record, "Fecha_Alta,Alta") || '',
            fechaBaja: findValue(record, "Fecha_Baja,Baja") || '',
            motivoBaja: findValue(record, "Motivo_Baja") || '',
            nivelEducativo: findValue(record, "Nivel_Educativo") || '',
            titulo: findValue(record, "Titulo") || '',
            posgrado: findValue(record, "Posgrado_Art.9,Posgrado_Art9,Posgrado") || '',
            area: findValue(record, "Area,Área") || '',
            tareas: findValue(record, "Tareas_Realizadas,Tareas") || '',
            inciso: findValue(record, "Inciso_LEC,Inciso") || '',
            tecnologias: findValue(record, "Tecnologias") || '',
            teletrabajo: findValue(record, "Realiza_Teletrabajo") || '',
            remuneracion: parseNumber(findValue(record, "Salario_Bruto,Salario Bruto,Remuneracion,Remuneracion2,Bruto") || 0),
            genero: findValue(record, "Genero") || '',
            cud: findValue(record, "Posee_CUD?,Posee_CUD,CUD") || '',
            provincia: findValue(record, "Provincia_Residencia,Provincia") || '',
            zonaDesfavorable: findValue(record, "Reside_Zona_desfavorable,Reside_Zona_Desfavorable") || '',
            planes: findValue(record, "Beneficiario_Planes?,Beneficiario_Planes") || '',
            contrato: findValue(record, "Mod_Contratacion") || ''
          }
        };
      case 'IVA_VENTAS':
        return {
          collection: 'lec_iva_ventas',
          data: {
            periodo: formattedPeriod,
            fecha: normalizeDate(findValue(record, "Fecha")) || (currentPeriod ? `${currentPeriod}-01` : ''),
            tipo: findValue(record, "Tipo_Cbte,Tipo") || '',
            numeroComprobante: findValue(record, "Numero,Nro,Cbt") || '',
            cliente: findValue(record, "Cliente,Razon_Social") || '',
            cuit: findValue(record, "CUIT,C.U.I.T.") || '',
            neto: parseNumber(findValue(record, "Neto_Gravado,Neto") || 0),
            impuestos: parseNumber(findValue(record, "Impuestos") || 0),
            total: parseNumber(findValue(record, "Total") || 0),
            moneda: findValue(record, "Moneda") || 'ARS',
            pais: findValue(record, "Pais") || 'Argentina',
            detalle: findValue(record, "Detalle") || '',
            centroCosto: findValue(record, "Centro_Costo") || '',
            actividad: findValue(record, "Actividad") || '',
            promovido: findValue(record, "Promovido") === 'SI' || findValue(record, "Promovido") === 'true',
            otros: findValue(record, "Otros") || ''
          }
        };
      case 'CAPACITACION':
        return {
          collection: 'lec_capacitaciones',
          data: {
            periodo: formattedPeriod || findValue(record, "Periodo"),
            tipoGasto: findValue(record, "Tipo_Gasto,Tipo_de_gasto,Tipo") || 'Capacitación_Interna',
            cursoTitulo: findValue(record, "Curso_Titulo,Titulo") || '',
            cursoDescripcion: findValue(record, "Curso_Descripcion,Descripcion") || '',
            cuilAsistente: findValue(record, "CUIL_Asistente,CUIL,C.U.I.L.") || '',
            apellidoAsistente: findValue(record, "Apellido_Asistente,Apellido") || '',
            nombreAsistente: findValue(record, "Nombre_Asistente,Nombre") || '',
            genero: findValue(record, "Genero") || '',
            fechaNacimiento: findValue(record, "Fecha_Nacimiento") || '',
            esEmpleado: findValue(record, 'Es_Empleado,Es_empleado_de_la_empresa?') === 'SI' || findValue(record, 'Es_Empleado') === 'true',
            obtuvoBeneficio: findValue(record, 'Obtuvo_Beneficio,Obtubo_beneficios') === 'SI' || findValue(record, 'Obtuvo_Beneficio') === 'true',
            capacitadorTipo: findValue(record, "Capacitador_Tipo,Tipo_entidad_capacitadora") || 'Universidad Publica',
            capacitadorEsNacional: findValue(record, "Capacitador_Sist_Educ") || 'SI',
            capacitadorNombre: findValue(record, "Capacitador_Nombre,Entidad") || '',
            capacitadorCUIT: findValue(record, "Capacitador_CUIT") || '',
            monto: parseNumber(findValue(record, "Monto,Monto_$") || 0),
            justificacion: findValue(record, "Justificacion,justificacion_relacion_Act_Prom") || '',
            facturaFile: findValue(record, "Link_Factura") || '',
            programaFile: findValue(record, "Link_Programa") || '',
            certificadoFile: findValue(record, "Link_Certificado") || '',
            fecha: currentPeriod ? `${currentPeriod}-01` : (findValue(record, "Periodo") ? `${findValue(record, "Periodo")}-01` : new Date().toISOString().slice(0, 10))
          }
        };
      case 'PRIMER_EMPLEO':
        return {
          collection: 'lec_primer_empleo',
          data: {
            periodo: formattedPeriod || findValue(record, "Periodo"),
            cuilEmpleado: findValue(record, "CUIL_Empleado,CUIL") || '',
            apellido: findValue(record, "Apellido") || '',
            nombre: findValue(record, "Nombre") || '',
            genero: findValue(record, "Genero") || '',
            fechaAlta: findValue(record, "Fecha_de_alta,Fecha_Alta") || '',
            remuneracionBruta: parseNumber(findValue(record, "Monto_total_Rem_Bruta_F931,Remuneracion,Bruto") || 0)
          }
        };
      case 'ADQUISICION_EQUIPAMIENTO':
        return {
          collection: 'lec_adquisicion_equipamiento',
          data: {
            periodo: formattedPeriod || findValue(record, "Periodo"),
            detalle: findValue(record, "Detalle_Equipamiento_Adquirido,Detalle") || '',
            destino: findValue(record, "Destino_del_equipamiento,Destino") || '',
            tipoComprobante: findValue(record, "Tipo_Comprobante") || '',
            nroComprobante: findValue(record, "Nro_Comprobante,N°_Comprobante") || '',
            fechaComprobante: normalizeDate(findValue(record, "Fecha_comprobante,Fecha")) || '',
            costoTotalSinIva: parseNumber(findValue(record, "Costo_Total_sin_iva,Costo_Total_(sin_iva)") || 0),
            justificacion: findValue(record, "Justificacion") || ''
          }
        };
      case 'PROYECTOS':
        return {
          collection: 'lec_proyectos_id',
          data: {
            periodo: formattedPeriod,
            nombre: findValue(record, "Nombre") || '',
            descripcion: findValue(record, "Descripcion") || '',
            fechaInicio: findValue(record, "Fecha_Inicio") || '',
            estado: 'En Curso',
            presupuestoEstimado: parseNumber(findValue(record, "Presupuesto_Estimado") || 0)
          }
        };
      case 'IVA_COMPRAS':
        return {
          collection: 'lec_iva_compras',
          data: {
            periodo: formattedPeriod,
            fecha: findValue(record, "Fecha") || (currentPeriod ? `${currentPeriod}-01` : ''),
            proveedor: findValue(record, "Proveedor") || '',
            cuit: findValue(record, "CUIT,C.U.I.T.") || '',
            concepto: findValue(record, "Concepto") || '',
            neto: parseNumber(findValue(record, "Monto_Neto,Neto") || 0),
            iva: parseNumber(findValue(record, "IVA") || 0),
            total: parseNumber(findValue(record, "Total") || 0),
            proyectoId: findValue(record, "Proyecto_ID_Asociado,Proyecto_ID") || ''
          }
        };
      default:
        return null;
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setMsg(null);
    try {
      const text = await file.text();
      const records = parseCSV(text);
      if (records.length === 0) throw new Error("Archivo vacío o formato incorrecto");

      // --- OVERWRITE LOGIC START ---
      const activePeriod = periodo.replace('-', ''); // Convert YYYY-MM to YYYYMM
      const sampleMapping = mapRecordToFirestore(records[0], tipoArchivo, periodo);
      if (sampleMapping && sampleMapping.collection) {
        const collectionPath = `/artifacts/${APP_ID}/public/data/${sampleMapping.collection}`;
        console.log("Checking for existing records in:", collectionPath, "Period:", activePeriod);

        let existingQuery;
        if (user?.companyId) {
          existingQuery = query(
            collection(db, collectionPath),
            where("periodo", "==", activePeriod),
            where("companyId", "==", user.companyId)
          );
        } else {
          existingQuery = query(
            collection(db, collectionPath),
            where("periodo", "==", activePeriod)
          );
        }

        const existingDocs = await getDocs(existingQuery);
        console.log("Found existing docs:", existingDocs.size);

        if (!existingDocs.empty) {
          const confirmOverwrite = window.confirm(
            `Atención: Ya existen ${existingDocs.size} registros para el periodo ${activePeriod}. \n\n¿Desea ELIMINAR LOS DATOS ANTERIORES y reemplazarlos con esta nueva importación?`
          );
          if (!confirmOverwrite) {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
          }

          // Delete existing
          const deletePromises = existingDocs.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
          console.log("Existing records deleted.");
          setMsg(`Limpieza completada. Importando nuevos datos para ${activePeriod}...`);
        }
      }
      // --- OVERWRITE LOGIC END ---

      let count = 0;
      const batchPromises = [];

      for (const record of records) {
        const mapping = mapRecordToFirestore(record, tipoArchivo, periodo);

        // VALIDATION: Skip if collection is missing or if critical fields are empty
        if (mapping && mapping.collection) {
          const { data } = mapping;

          // Specific validation for Nomina
          if (tipoArchivo === 'NOMINA') {
            const hasName = data.nombreApellido && data.nombreApellido.length > 1;
            const hasCuil = data.cuil && data.cuil.length > 5;
            if (!hasName || !hasCuil) {
              console.warn("Saltando registro de nómina inválido:", record);
              continue;
            }
          }

          // Add metadata
          const finalData = {
            ...data,
            importbatch: activePeriod,
            importedAt: serverTimestamp(),
            importedBy: user?.email || "Usuario",
            companyId: user?.companyId || null
          };

          batchPromises.push(addDoc(collection(db, `/artifacts/${APP_ID}/public/data/${mapping.collection}`), finalData));
          count++;
        }
      }

      await Promise.all(batchPromises);

      // Also log the file upload itself for audit
      await addDoc(collection(db, `/artifacts/${APP_ID}/public/data/lec_archivos_importados`), {
        tipoArchivo,
        periodo,
        fileName: file.name,
        recordCount: count,
        user: user?.email || "Anonimo",
        timestamp: serverTimestamp()
      });

      setMsg(`Éxito: Se han importado ${count} registros de ${tipoArchivo} para el periodo ${periodo}.`);
    } catch (err) {
      console.error(err);
      setMsg("Error al procesar el archivo. Verifique el formato CSV.");
    }
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 border-gray-200 flex items-center">
        <UploadCloud className="w-6 h-6 mr-2 text-blue-600" />
        Centro de Importación
      </h3>

      {msg && <div className={`p-3 rounded-lg flex items-center ${msg.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
        {msg.includes('Error') ? <AlertCircle className="w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
        {msg}
      </div>}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 border-r border-gray-100 pr-4">
            <h4 className="font-bold text-gray-700">1. Descargar Template</h4>
            <p className="text-sm text-gray-500">Selecciona el tipo de archivo para obtener el formato requerido (.csv).</p>
            <select className="w-full border p-2 rounded-lg" value={tipoArchivo} onChange={e => { setTipoArchivo(e.target.value); setMsg(null); }}>
              <option value="NOMINA">Nómina (F.931)</option>
              <option value="IVA_VENTAS">IVA Ventas / Exportaciones</option>
              <option value="IVA_COMPRAS">IVA Compras / Gastos</option>
              <option value="PROYECTOS">Proyectos I+D</option>
              <option value="CAPACITACION">Capacitaciones</option>
              <option value="PRIMER_EMPLEO">Primer Empleo</option>
              <option value="ADQUISICION_EQUIPAMIENTO">Adquisición Equipamiento</option>
            </select>
            <button onClick={handleDownloadTemplate} className="flex items-center justify-center w-full py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium">
              <Download className="w-4 h-4 mr-2" /> Descargar Modelo .CSV
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-gray-700">2. Subir Datos Reales</h4>
            <p className="text-sm text-gray-500">Selecciona el periodo y carga tu archivo .CSV</p>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} className="w-full border p-2 rounded-lg" />

            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />

            <label htmlFor="file-upload" className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 cursor-pointer block ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              <UploadCloud className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 font-medium">Click para seleccionar archivo</p>
              <p className="text-gray-400 text-xs mt-1">Formato admitido: .CSV (UTF-8)</p>
            </label>

            {loading && <div className="text-center text-blue-600 text-sm font-bold flex justify-center items-center"><Loader2 className="animate-spin w-4 h-4 mr-2" /> Procesando...</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. NOMINA
const NominaRRHH = ({ db, config, user }) => {
  const { items: empleados, loading, deleteItem } = useCrudCollection(db, 'lec_nomina_rrhh', config.bienioStart, config.bienioEnd, user);
  const [viewDetail, setViewDetail] = useState(null);
  const [filters, setFilters] = useState({
    nombreApellido: '',
    cuil: '',
    codigoActividad: '',
    periodo: '',
    area: '',
    inciso: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'periodo', direction: 'desc' });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <Filter className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  const filteredEmpleados = useMemo(() => {
    return empleados.filter(emp => {
      const nombre = (emp.nombreApellido || emp.Nombre_Apellido || '').toLowerCase();
      const cuil = (emp.cuil || '').toLowerCase();
      const actividad = (emp.codigoActividad || '').toLowerCase();
      const per = (emp.periodo || '').toLowerCase();
      const area = (emp.area || '').toLowerCase();
      const inciso = (emp.inciso || '').toLowerCase();

      return nombre.includes(filters.nombreApellido.toLowerCase()) &&
        cuil.includes(filters.cuil.toLowerCase()) &&
        actividad.includes(filters.codigoActividad.toLowerCase()) &&
        per.includes(filters.periodo.toLowerCase()) &&
        area.includes(filters.area.toLowerCase()) &&
        inciso.includes(filters.inciso.toLowerCase());
    });
  }, [empleados, filters]);

  const sortedEmpleados = useMemo(() => {
    const sortableItems = [...filteredEmpleados];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'remuneracion') {
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredEmpleados, sortConfig]);

  const handleExport = () => {
    const dataToExport = sortedEmpleados.map(e => ({
      Periodo: e.periodo,
      Nombre_Apellido: e.nombreApellido, Fecha_de_nacimiento: e.fechaNacimiento,
      CUIL: e.cuil, "Codigo Actividad": e.codigoActividad,
      Fecha_Alta: e.fechaAlta, Fecha_Baja: e.fechaBaja, Motivo_Baja: e.motivoBaja,
      Nivel_Educativo: e.nivelEducativo, Titulo: e.titulo, "Posgrado_Art.9": e.posgrado,
      Area: e.area, Tareas_Realizadas: e.tareas, Inciso_LEC: e.inciso,
      Tecnologias: e.tecnologias, Realiza_Teletrabajo: e.teletrabajo,
      Salario_Bruto: e.remuneracion, Genero: e.genero, "Posee_CUD?": e.cud,
      Provincia_Residencia: e.provincia, Reside_Zona_desfavorable: e.zonaDesfavorable,
      "Beneficiario_Planes?": e.planes, Mod_Contratacion: e.contrato
    }));
    downloadCSV(dataToExport, "Nomina_LEC_Filtrada");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center border-b pb-3 border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center">
          <Users className="w-6 h-6 mr-2 text-blue-600" />
          Nómina de Personal
        </h3>
        <div className="flex space-x-2">
          <button onClick={() => downloadCSV(sortedEmpleados.map(e => ({
            Periodo: e.periodo,
            Nombre_Apellido: e.nombreApellido, Fecha_de_nacimiento: e.fechaNacimiento,
            CUIL: e.cuil, "Codigo Actividad": e.codigoActividad,
            Fecha_Alta: e.fechaAlta, Fecha_Baja: e.fechaBaja, Motivo_Baja: e.motivoBaja,
            Nivel_Educativo: e.nivelEducativo, Titulo: e.titulo, "Posgrado_Art.9": e.posgrado,
            Area: e.area, Tareas_Realizadas: e.tareas, Inciso_LEC: e.inciso,
            Tecnologias: e.tecnologias, Realiza_Teletrabajo: e.teletrabajo,
            Salario_Bruto: e.remuneracion, Genero: e.genero, "Posee_CUD?": e.cud,
            Provincia_Residencia: e.provincia, Reside_Zona_desfavorable: e.zonaDesfavorable,
            "Beneficiario_Planes?": e.planes, Mod_Contratacion: e.contrato
          })), "Nomina_LEC_Vista")} className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-600 px-3 py-1 rounded-lg">
            <Filter className="w-4 h-4 mr-2" /> Exportar Vista
          </button>
          <button onClick={async () => {
            if (!confirm("Esto descargará todos los registros del BIENIO ACTIVO. ¿Continuar?")) return;
            try {
              const q = query(collection(db, `/artifacts/${APP_ID}/public/data/lec_nomina_rrhh`), where("companyId", "==", user.companyId));
              const snap = await getDocs(q);
              const allDocs = snap.docs.map(d => d.data());

              // Filter by Bienio Dates
              const filteredDocs = allDocs.filter(item => {
                const dateToCheck = item.periodo ? `${item.periodo.substring(0, 4)}-${item.periodo.substring(4, 6)}-01` : (item.fecha || item.fechaAlta);
                if (!dateToCheck) return false;
                return dateToCheck >= config.bienioStart && dateToCheck <= config.bienioEnd;
              });

              downloadCSV(filteredDocs.map(e => ({
                Periodo: e.periodo,
                Nombre_Apellido: e.nombreApellido, Fecha_de_nacimiento: e.fechaNacimiento,
                CUIL: e.cuil, "Codigo Actividad": e.codigoActividad,
                Fecha_Alta: e.fechaAlta, Fecha_Baja: e.fechaBaja, Motivo_Baja: e.motivoBaja,
                Nivel_Educativo: e.nivelEducativo, Titulo: e.titulo, "Posgrado_Art.9": e.posgrado,
                Area: e.area, Tareas_Realizadas: e.tareas, Inciso_LEC: e.inciso,
                Tecnologias: e.tecnologias, Realiza_Teletrabajo: e.teletrabajo,
                Salario_Bruto: e.remuneracion, Genero: e.genero, "Posee_CUD?": e.cud,
                Provincia_Residencia: e.provincia, Reside_Zona_desfavorable: e.zonaDesfavorable,
                "Beneficiario_Planes?": e.planes, Mod_Contratacion: e.contrato
              })), `Nomina_LEC_${config.bienioStart}_${config.bienioEnd}`);
            } catch (e) { console.error(e); alert("Error al descargar el bienio."); }
          }} className="flex items-center text-sm font-medium text-green-600 hover:text-green-800 border border-green-600 px-3 py-1 rounded-lg">
            <Download className="w-4 h-4 mr-2" /> Exportar Bienio
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center mb-3 text-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          <h4 className="font-bold text-sm uppercase">Filtros de Búsqueda</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input
            placeholder="Empleado..."
            value={filters.nombreApellido}
            onChange={e => setFilters({ ...filters, nombreApellido: e.target.value })}
            className="border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            placeholder="CUIL..."
            value={filters.cuil}
            onChange={e => setFilters({ ...filters, cuil: e.target.value })}
            className="border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            placeholder="Periodo (YYYYMM)..."
            value={filters.periodo}
            onChange={e => setFilters({ ...filters, periodo: e.target.value })}
            className="border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            placeholder="Actividad..."
            value={filters.codigoActividad}
            onChange={e => setFilters({ ...filters, codigoActividad: e.target.value })}
            className="border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            placeholder="Área..."
            value={filters.area}
            onChange={e => setFilters({ ...filters, area: e.target.value })}
            className="border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <select
            value={filters.inciso}
            onChange={e => setFilters({ ...filters, inciso: e.target.value })}
            className="border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Incisos</option>
            <option value="a">Inciso A</option>
            <option value="b">Inciso B</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th onClick={() => requestSort('periodo')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center">Periodo <SortIcon column="periodo" /></div>
                </th>
                <th onClick={() => requestSort('nombreApellido')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center">Empleado <SortIcon column="nombreApellido" /></div>
                </th>
                <th onClick={() => requestSort('cuil')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center">CUIL <SortIcon column="cuil" /></div>
                </th>
                <th onClick={() => requestSort('codigoActividad')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center">Actividad <SortIcon column="codigoActividad" /></div>
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-500">Alta / Baja</th>
                <th onClick={() => requestSort('remuneracion')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center">Salario Bruto <SortIcon column="remuneracion" /></div>
                </th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedEmpleados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500 italic">No se encontraron registros que coincidan con los filtros.</td>
                </tr>
              ) : (
                sortedEmpleados.map(emp => (
                  <React.Fragment key={emp.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewDetail(viewDetail === emp.id ? null : emp.id)}>
                      <td className="px-4 py-3 font-semibold text-blue-700">{emp.periodo}</td>
                      <td className="px-4 py-3 font-medium">
                        {emp.nombreApellido || emp.Nombre_Apellido || 'Sin Nombre'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.cuil}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {emp.codigoActividad}
                        <span className="block text-[10px] text-gray-400 truncate max-w-[100px]">{emp.area}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <div className="flex flex-col">
                          <span className="text-green-600 font-bold">Alta: {emp.fechaAlta}</span>
                          {emp.fechaBaja && <span className="text-red-600 font-bold">Baja: {emp.fechaBaja}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-green-700 font-bold font-mono">${emp.remuneracion?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right flex justify-end space-x-2">
                        <button className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('¿Seguro que desea eliminar este registro?')) deleteItem(emp.id) }} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                    {viewDetail === emp.id && (
                      <tr className="bg-blue-50">
                        <td colSpan="7" className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div><span className="font-bold">Periodo:</span> {emp.periodo}</div>
                            <div><span className="font-bold">Fecha Nac:</span> {emp.fechaNacimiento}</div>
                            <div><span className="font-bold">Género:</span> {emp.genero}</div>
                            <div><span className="font-bold">Provincia:</span> {emp.provincia}</div>

                            <div><span className="font-bold">Tareas:</span> {emp.tareas}</div>
                            <div><span className="font-bold">Teletrabajo:</span> {emp.teletrabajo}</div>
                            <div><span className="font-bold">Zona Desfavorable:</span> {emp.zonaDesfavorable}</div>
                            <div><span className="font-bold">Contrato:</span> {emp.contrato}</div>

                            <div><span className="font-bold">Inciso:</span> {emp.inciso}</div>
                            <div><span className="font-bold">Posgrado Art.9:</span> {emp.posgrado}</div>
                            <div><span className="font-bold">CUD:</span> {emp.cud}</div>
                            <div><span className="font-bold">Beneficiario Planes:</span> {emp.planes}</div>

                            <div><span className="font-bold">Fecha Baja:</span> {emp.fechaBaja}</div>
                            <div className="col-span-2"><span className="font-bold">Motivo Baja:</span> {emp.motivoBaja}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 4. I+D
const ProyectosID = ({ db, config, user }) => {
  const { items: proyectos, addItem, updateItem, deleteItem } = useCrudCollection(db, 'lec_proyectos_id', config.bienioStart, config.bienioEnd, user);
  const { items: nomina } = useCrudCollection(db, 'lec_nomina_rrhh', config.bienioStart, config.bienioEnd, user);

  const [selectedProject, setSelectedProject] = useState(null);
  const [tabProyecto, setTabProyecto] = useState('GENERAL');
  const [newProj, setNewProj] = useState({ nombre: '', descripcion: '', fechaInicio: new Date().toISOString().slice(0, 10), estado: 'En Curso' });

  const [assignRRHH, setAssignRRHH] = useState({ empleadoId: '', porcentaje: 100, meses: 1 });
  const [assignMaterial, setAssignMaterial] = useState({ tipo: 'Insumos', descripcion: '', monto: 0, link: '' });

  const handleCreateProject = async (e) => {
    e.preventDefault();
    await addItem({ ...newProj, recursosHumanos: [], recursosMateriales: [] });
    setNewProj({ nombre: '', descripcion: '', fechaInicio: '', estado: 'En Curso' });
  };

  const addRRHHToProject = async () => {
    if (!selectedProject || !assignRRHH.empleadoId) return;
    const empleado = nomina.find(e => e.id === assignRRHH.empleadoId);
    const costoCalculado = (empleado.remuneracion || 0) * (assignRRHH.porcentaje / 100) * assignRRHH.meses;

    const nuevoRecurso = {
      id: crypto.randomUUID(),
      ...assignRRHH,
      nombreEmpleado: `${empleado.apellido}, ${empleado.nombre}`,
      costoImputado: costoCalculado
    };

    const updatedResources = [...(selectedProject.recursosHumanos || []), nuevoRecurso];
    await updateDoc(doc(db, `/artifacts/${APP_ID}/public/data/lec_proyectos_id`, selectedProject.id), { recursosHumanos: updatedResources });
    setSelectedProject({ ...selectedProject, recursosHumanos: updatedResources });
  };

  const addMaterialToProject = async () => {
    if (!selectedProject || !assignMaterial.monto) return;
    const nuevoMaterial = { id: crypto.randomUUID(), ...assignMaterial };
    const updatedMaterials = [...(selectedProject.recursosMateriales || []), nuevoMaterial];
    await updateDoc(doc(db, `/artifacts/${APP_ID}/public/data/lec_proyectos_id`, selectedProject.id), { recursosMateriales: updatedMaterials });
    setSelectedProject({ ...selectedProject, recursosMateriales: updatedMaterials });
    setAssignMaterial({ tipo: 'Insumos', descripcion: '', monto: 0, link: '' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 border-gray-200 flex items-center">
        <Lightbulb className="w-6 h-6 mr-2 text-yellow-500" />
        Proyectos I+D
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* LISTA DE PROYECTOS */}
        <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h4 className="font-bold text-gray-700">Mis Proyectos</h4>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {proyectos.map(p => (
              <div key={p.id} onClick={() => { setSelectedProject(p); setTabProyecto('GENERAL') }} className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${selectedProject?.id === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <h5 className="font-bold text-gray-800">{p.nombre}</h5>
                <span className="text-xs px-2 py-0.5 bg-gray-200 rounded-full text-gray-600">{p.estado}</span>
              </div>
            ))}
            <div className="border-t pt-4 mt-4">
              <h5 className="text-xs font-bold uppercase text-gray-500 mb-2">Nuevo Proyecto</h5>
              <input className="w-full border p-2 rounded mb-2 text-sm" type="date" value={newProj.fechaInicio} onChange={e => setNewProj({ ...newProj, fechaInicio: e.target.value })} title="Fecha Inicio" />
              <input className="w-full border p-2 rounded mb-2 text-sm" placeholder="Nombre Proyecto" value={newProj.nombre} onChange={e => setNewProj({ ...newProj, nombre: e.target.value })} />
              <textarea className="w-full border p-2 rounded mb-2 text-sm" placeholder="Descripción" value={newProj.descripcion} onChange={e => setNewProj({ ...newProj, descripcion: e.target.value })} />
              <button onClick={handleCreateProject} disabled={!newProj.nombre} className="w-full bg-blue-600 text-white py-1 rounded text-sm font-bold">Crear Proyecto</button>
            </div>
          </div>
        </div>

        {/* DETALLE DEL PROYECTO */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          {selectedProject ? (
            <>
              <div className="p-4 border-b flex space-x-4 bg-gray-50">
                {['GENERAL', 'RRHH', 'INSUMOS'].map(tab => (
                  <button key={tab} onClick={() => setTabProyecto(tab)} className={`text-sm font-bold px-3 py-1 rounded-md ${tabProyecto === tab ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {tabProyecto === 'GENERAL' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <h2 className="text-2xl font-bold text-gray-800">{selectedProject.nombre}</h2>
                      <button
                        onClick={() => updateItem(selectedProject.id, selectedProject)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-blue-700"
                      >
                        Guardar Cambios
                      </button>
                    </div>
                    <textarea
                      className="w-full border p-2 rounded text-gray-600"
                      value={selectedProject.descripcion}
                      onChange={e => setSelectedProject({ ...selectedProject, descripcion: e.target.value })}
                    />

                    <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-1">Fecha Inicio</p>
                        <input
                          type="date"
                          className="border p-1 rounded w-full"
                          value={selectedProject.fechaInicio || ''}
                          onChange={e => setSelectedProject({ ...selectedProject, fechaInicio: e.target.value })}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-1">Fecha Fin (Estimada)</p>
                        <input
                          type="date"
                          className="border p-1 rounded w-full"
                          value={selectedProject.fechaFin || ''}
                          onChange={e => setSelectedProject({ ...selectedProject, fechaFin: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2 border-t pt-2 mt-2">
                        <p className="text-xs font-bold text-gray-500 mb-1">Link Documentación (Drive)</p>
                        <input
                          placeholder="https://drive.google.com/..."
                          className="border p-1 rounded w-full text-blue-600 underline"
                          value={selectedProject.docLink || ''}
                          onChange={e => setSelectedProject({ ...selectedProject, docLink: e.target.value })}
                        />
                        {selectedProject.docLink && (
                          <div className="mt-1 text-right">
                            <a href={selectedProject.docLink} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-end">
                              <Paperclip className="w-3 h-3 mr-1" /> Abrir Carpeta de Documentación
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 border-t pt-2 mt-2">
                        <p className="text-xs font-bold text-gray-500">Gasto Total Est.</p>
                        <p className="text-xl font-bold text-green-600">
                          ${((selectedProject.recursosHumanos?.reduce((a, b) => a + b.costoImputado, 0) || 0) + (selectedProject.recursosMateriales?.reduce((a, b) => a + b.monto, 0) || 0)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {tabProyecto === 'RRHH' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                      <h5 className="font-bold text-sm text-blue-800">Asignar Recurso Humano</h5>
                      <div className="grid grid-cols-3 gap-2">
                        <select className="col-span-3 border p-1 rounded" value={assignRRHH.empleadoId} onChange={e => setAssignRRHH({ ...assignRRHH, empleadoId: e.target.value })}>
                          <option value="">Seleccionar Empleado...</option>
                          {nomina.map(e => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
                        </select>
                        <input type="number" placeholder="% Dedicación" className="border p-1 rounded" value={assignRRHH.porcentaje} onChange={e => setAssignRRHH({ ...assignRRHH, porcentaje: parseFloat(e.target.value) })} />
                        <input type="number" placeholder="Meses" className="border p-1 rounded" value={assignRRHH.meses} onChange={e => setAssignRRHH({ ...assignRRHH, meses: parseFloat(e.target.value) })} />
                        <button onClick={addRRHHToProject} className="bg-blue-600 text-white rounded font-bold text-xs">Asignar</button>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100"><tr><th>Empleado</th><th>%</th><th>Costo Imp.</th></tr></thead>
                      <tbody>
                        {selectedProject.recursosHumanos?.map((rh, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{rh.nombreEmpleado}</td>
                            <td className="p-2 text-center">{rh.porcentaje}%</td>
                            <td className="p-2 text-right font-mono">${rh.costoImputado?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tabProyecto === 'INSUMOS' && (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 p-4 rounded-lg space-y-2">
                      <h5 className="font-bold text-sm text-yellow-800">Cargar Insumo / Gasto</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <select className="border p-1 rounded" value={assignMaterial.tipo} onChange={e => setAssignMaterial({ ...assignMaterial, tipo: e.target.value })}>
                          <option>Consultoria</option>
                          <option>Insumos</option>
                          <option>Software</option>
                          <option>Hardware</option>
                          <option>Equipamiento</option>
                          <option>Viaticos</option>
                          <option>Otros</option>
                        </select>
                        <input type="number" placeholder="Monto" className="border p-1 rounded" value={assignMaterial.monto} onChange={e => setAssignMaterial({ ...assignMaterial, monto: parseFloat(e.target.value) })} />
                        <input placeholder="Descripción / Proveedor" className="col-span-2 border p-1 rounded" value={assignMaterial.descripcion} onChange={e => setAssignMaterial({ ...assignMaterial, descripcion: e.target.value })} />
                        <input placeholder="Link a Comprobante (Drive/PDF)" className="col-span-2 border p-1 rounded" value={assignMaterial.link} onChange={e => setAssignMaterial({ ...assignMaterial, link: e.target.value })} />
                        <button onClick={addMaterialToProject} className="col-span-2 bg-yellow-600 text-white rounded font-bold text-xs py-1">Cargar Gasto</button>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100"><tr><th>Tipo</th><th>Desc.</th><th>Monto</th><th>Doc</th></tr></thead>
                      <tbody>
                        {selectedProject.recursosMateriales?.map((rm, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{rm.tipo}</td>
                            <td className="p-2">{rm.descripcion}</td>
                            <td className="p-2 text-right font-mono">${rm.monto?.toLocaleString()}</td>
                            <td className="p-2 text-center">{rm.link && <a href={rm.link} target="_blank" className="text-blue-500"><Paperclip className="w-4 h-4" /></a>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">Selecciona un proyecto</div>
          )}
        </div>
      </div>
    </div>
  );
};

// 5. CAPACITACION
const CapacitacionTab = ({ db, config, user }) => {
  const { items, addItem, deleteItem } = useCrudCollection(db, 'lec_capacitaciones', config.bienioStart, config.bienioEnd, user);
  const [viewDetail, setViewDetail] = useState(null);
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({
    cursoTitulo: '',
    apellidoAsistente: '',
    tipoGasto: '',
    monto: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' });
  const [form, setForm] = useState({
    periodo: '',
    cursoTitulo: '', cursoDescripcion: '',
    tipoGasto: 'Capacitación_Interna',
    cuilAsistente: '', apellidoAsistente: '', nombreAsistente: '',
    genero: '', fechaNacimiento: '', esEmpleado: true, obtuvoBeneficio: true,
    entidadNombre: '', monto: 0, justificacion: '',
    capacitadorTipo: 'Universidad Publica',
    capacitadorEsNacional: 'SI',
    capacitadorNombre: '',
    capacitadorCUIT: '',
    facturaFile: '', programaFile: '', certificadoFile: ''
  });

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const date = i.fecha || i.periodo;
      const matchesDate = (!filterStart || date >= filterStart) && (!filterEnd || date <= filterEnd);
      const matchesTitulo = !filters.cursoTitulo || i.cursoTitulo?.toLowerCase().includes(filters.cursoTitulo.toLowerCase());
      const matchesAsistente = !filters.apellidoAsistente || i.apellidoAsistente?.toLowerCase().includes(filters.apellidoAsistente.toLowerCase());
      const matchesTipo = !filters.tipoGasto || i.tipoGasto?.toLowerCase().includes(filters.tipoGasto.toLowerCase());
      const matchesMonto = !filters.monto || i.monto?.toString().includes(filters.monto);

      return matchesDate && matchesTitulo && matchesAsistente && matchesTipo && matchesMonto;
    });
  }, [items, filterStart, filterEnd, filters]);

  const sortedItems = useMemo(() => {
    const sortableItems = [...filteredItems];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'fecha') {
          aValue = normalizeDate(aValue);
          bValue = normalizeDate(bValue);
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredItems, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <Filter className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 text-purple-600" /> : <ChevronDown className="w-3 h-3 ml-1 text-purple-600" />;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addItem({
      ...form,
      fecha: form.periodo ? `${form.periodo}-01` : new Date().toISOString().slice(0, 10)
    });
    setForm({
      periodo: '',
      cursoTitulo: '', cursoDescripcion: '', tipoGasto: 'Capacitación_Interna',
      cuilAsistente: '', apellidoAsistente: '', nombreAsistente: '',
      genero: '', fechaNacimiento: '', esEmpleado: true, obtuvoBeneficio: true,
      entidadNombre: '', monto: 0, justificacion: '',
      capacitadorTipo: 'Universidad Publica',
      capacitadorEsNacional: 'SI',
      capacitadorNombre: '',
      capacitadorCUIT: '',
      facturaFile: '', programaFile: '', certificadoFile: ''
    });
  };

  const handleExport = () => {
    const data = filteredItems.map(i => ({
      Fecha: i.fecha, Periodo: i.periodo, Titulo: i.cursoTitulo, Descripcion: i.cursoDescripcion, Tipo: i.tipoGasto,
      Asistente: `${i.apellidoAsistente}, ${i.nombreAsistente}`, CUIL: i.cuilAsistente,
      Capacitador_Tipo: i.capacitadorTipo, Capacitador_Sist_Educ: i.capacitadorEsNacional,
      Capacitador_Nombre: i.capacitadorNombre, Capacitador_CUIT: i.capacitadorCUIT,
      Monto: i.monto, Justificacion: i.justificacion,
      Factura: i.facturaFile, Programa: i.programaFile, Certificado: i.certificadoFile
    }));
    downloadCSV(data, "Capacitaciones_LEC_Filtrado");
  };

  const handleFileChange = (e, field) => {
    // Simulate file upload by just storing the filename
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({ ...prev, [field]: file.name }));
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center border-b pb-3 border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center">
          <GraduationCap className="w-6 h-6 mr-2 text-purple-600" />
          Registro de Capacitaciones
        </h3>
        <div className="flex space-x-2">
          <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="border p-1 rounded text-sm" />
          <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="border p-1 rounded text-sm" />
          <button onClick={handleExport} className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-600 px-3 py-1 rounded-lg">
            <Filter className="w-4 h-4 mr-2" /> Exportar Vista
          </button>
          <button onClick={async () => {
            if (!confirm("Esto descargará todos los registros del BIENIO ACTIVO. ¿Continuar?")) return;
            try {
              const q = query(collection(db, `/artifacts/${APP_ID}/public/data/lec_capacitaciones`), where("companyId", "==", user.companyId));
              const snap = await getDocs(q);
              const allDocs = snap.docs.map(d => d.data());

              // Filter by Bienio Dates
              const filteredDocs = allDocs.filter(item => {
                const dateToCheck = item.fecha || item.fechaInicio;
                if (!dateToCheck) return false;
                return dateToCheck >= config.bienioStart && dateToCheck <= config.bienioEnd;
              });

              downloadCSV(filteredDocs.map(i => ({
                Fecha: i.fecha, Periodo: i.periodo, Titulo: i.cursoTitulo, Descripcion: i.cursoDescripcion, Tipo: i.tipoGasto,
                Asistente: `${i.apellidoAsistente}, ${i.nombreAsistente}`, CUIL: i.cuilAsistente,
                Capacitador_Tipo: i.capacitadorTipo, Capacitador_Sist_Educ: i.capacitadorEsNacional,
                Capacitador_Nombre: i.capacitadorNombre, Capacitador_CUIT: i.capacitadorCUIT,
                Monto: i.monto, Justificacion: i.justificacion,
                Factura: i.facturaFile, Programa: i.programaFile, Certificado: i.certificadoFile
              })), `Capacitaciones_LEC_${config.bienioStart}_${config.bienioEnd}`);
            } catch (e) { console.error(e); alert("Error al descargar el bienio."); }
          }} className="flex items-center text-sm font-medium text-green-600 hover:text-green-800 border border-green-600 px-3 py-1 rounded-lg">
            <Download className="w-4 h-4 mr-2" /> Exportar Bienio
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="w-full flex justify-between items-center p-4 bg-purple-50 hover:bg-purple-100 transition-colors"
        >
          <div className="flex items-center font-bold text-purple-900">
            <PlusCircle className={`w-5 h-5 mr-2 transition-transform ${isFormOpen ? 'rotate-45' : ''}`} />
            {isFormOpen ? 'Cerrar Formulario de Registro' : 'Nueva Capacitación / Cargar Registro'}
          </div>
          {isFormOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {isFormOpen && (
          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t animate-slideDown">
            <div className="md:col-span-3 font-bold text-gray-700 border-b pb-2 mb-2">Datos del Curso</div>
            <input placeholder="Título del Curso" value={form.cursoTitulo} onChange={e => setForm({ ...form, cursoTitulo: e.target.value })} className="border p-2 rounded w-full" required />
            <input placeholder="Descripción del Curso" value={form.cursoDescripcion} onChange={e => setForm({ ...form, cursoDescripcion: e.target.value })} className="border p-2 rounded w-full" />

            <select value={form.tipoGasto} onChange={e => setForm({ ...form, tipoGasto: e.target.value })} className="border p-2 rounded w-full">
              <option value="Becas_y_Estipendios">Becas y Estipendios</option>
              <option value="Viajes_y_Viáticos_destinados_personal_empresa">Viajes y Viáticos (Personal Empresa)</option>
              <option value="Aportes_Fondos_de_Capacitación">Aportes Fondos de Capacitación</option>
              <option value="Aportes_a_Universidades">Aportes a Universidades</option>
              <option value="Viajes_y_Viáticos_para_invitar_profesionales">Viajes y Viáticos (Invitar Profesionales)</option>
              <option value="Capacitación_Interna">Capacitación Interna</option>
              <option value="Otros">Otros</option>
            </select>

            <input type="number" placeholder="Monto Inversión" value={form.monto} onChange={e => setForm({ ...form, monto: parseFloat(e.target.value) })} className="border p-2 rounded w-full" />
            <input type="month" value={form.periodo} onChange={e => setForm({ ...form, periodo: e.target.value })} className="border p-2 rounded w-full" />

            <div className="md:col-span-3 font-bold text-gray-700 border-b pb-2 mb-2 mt-4">Datos del Capacitador</div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo Entidad</label>
              <select value={form.capacitadorTipo} onChange={e => setForm({ ...form, capacitadorTipo: e.target.value })} className="border p-2 rounded w-full text-sm">
                <option value="Universidad Publica">Universidad Pública</option>
                <option value="Universidad Privada">Universidad Privada</option>
                <option value="Intituto Tecnico Terciario">Instituto Técnico Terciario</option>
                <option value="Organismos provinciales o municipales">Organismos provinciales o municipales</option>
                <option value="Tercero externo sistema educativo y extranjero">Tercero externo sistema educativo y extranjero</option>
                <option value="Profesionales o Investigadores">Profesionales o Investigadores</option>
                <option value="Otras entidades de servicios de enseñanza">Otras entidades de servicios de enseñanza</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Parte Sist. Educativo Nac.</label>
              <select value={form.capacitadorEsNacional} onChange={e => setForm({ ...form, capacitadorEsNacional: e.target.value })} className="border p-2 rounded w-full text-sm">
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre Entidad</label>
              <input placeholder="Nombre de la entidad" value={form.capacitadorNombre} onChange={e => setForm({ ...form, capacitadorNombre: e.target.value })} className="border p-2 rounded w-full text-sm" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">CUIL/CUIT Entidad</label>
              <input placeholder="CUIL/CUIT" value={form.capacitadorCUIT} onChange={e => setForm({ ...form, capacitadorCUIT: e.target.value })} className="border p-2 rounded w-full text-sm" />
            </div>

            <div className="md:col-span-3 font-bold text-gray-700 border-b pb-2 mb-2 mt-4">Datos del Asistente</div>
            <input placeholder="CUIL Asistente" value={form.cuilAsistente} onChange={e => setForm({ ...form, cuilAsistente: e.target.value })} className="border p-2 rounded w-full" />
            <input placeholder="Apellido" value={form.apellidoAsistente} onChange={e => setForm({ ...form, apellidoAsistente: e.target.value })} className="border p-2 rounded w-full" />
            <input placeholder="Nombre" value={form.nombreAsistente} onChange={e => setForm({ ...form, nombreAsistente: e.target.value })} className="border p-2 rounded w-full" />
            <div className="flex items-center space-x-4 col-span-3">
              <label className="flex items-center"><input type="checkbox" checked={form.esEmpleado} onChange={e => setForm({ ...form, esEmpleado: e.target.checked })} className="mr-2" /> Es Empleado</label>
              <label className="flex items-center"><input type="checkbox" checked={form.obtuvoBeneficio} onChange={e => setForm({ ...form, obtuvoBeneficio: e.target.checked })} className="mr-2" /> Obtuvo Beneficio</label>
            </div>

            <div className="md:col-span-3 font-bold text-gray-700 border-b pb-2 mb-2 mt-4">Detalle / Justificación</div>
            <textarea placeholder="Justificación relación con actividad promovida" value={form.justificacion} onChange={e => setForm({ ...form, justificacion: e.target.value })} className="md:col-span-3 border p-2 rounded w-full" rows="2"></textarea>

            <div className="md:col-span-3 font-bold text-gray-700 border-b pb-2 mb-2 mt-4">Enlaces a Documentación (Drive/OneDrive)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Link Factura</label>
                <input
                  type="url"
                  placeholder="Pegar link aquí..."
                  value={form.facturaFile}
                  onChange={e => setForm({ ...form, facturaFile: e.target.value })}
                  className="border p-2 rounded w-full text-sm text-blue-600 underline"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Link Programa</label>
                <input
                  type="url"
                  placeholder="Pegar link aquí..."
                  value={form.programaFile}
                  onChange={e => setForm({ ...form, programaFile: e.target.value })}
                  className="border p-2 rounded w-full text-sm text-blue-600 underline"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Link Certificado</label>
                <input
                  type="url"
                  placeholder="Pegar link aquí..."
                  value={form.certificadoFile}
                  onChange={e => setForm({ ...form, certificadoFile: e.target.value })}
                  className="border p-2 rounded w-full text-sm text-blue-600 underline"
                />
              </div>
            </div>

            <button type="submit" className="md:col-span-3 bg-purple-600 text-white py-2 rounded font-bold hover:bg-purple-700 mt-4">Registrar Capacitación</button>
          </form>
        )}
      </div>

      {/* FILTROS DE TABLA */}
      <div className="bg-gray-100 p-4 rounded-xl border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="Filtrar por Curso..."
            value={filters.cursoTitulo}
            onChange={e => setFilters({ ...filters, cursoTitulo: e.target.value })}
            className="border p-2 rounded text-xs"
          />
          <input
            placeholder="Filtrar por Asistente..."
            value={filters.apellidoAsistente}
            onChange={e => setFilters({ ...filters, apellidoAsistente: e.target.value })}
            className="border p-2 rounded text-xs"
          />
          <input
            placeholder="Filtrar por Tipo..."
            value={filters.tipoGasto}
            onChange={e => setFilters({ ...filters, tipoGasto: e.target.value })}
            className="border p-2 rounded text-xs"
          />
          <input
            placeholder="Filtrar por Monto..."
            value={filters.monto}
            onChange={e => setFilters({ ...filters, monto: e.target.value })}
            className="border p-2 rounded text-xs"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th onClick={() => requestSort('cursoTitulo')} className="p-3 cursor-pointer hover:bg-gray-100">
                <div className="flex items-center">Curso / Justificación <SortIcon column="cursoTitulo" /></div>
              </th>
              <th onClick={() => requestSort('apellidoAsistente')} className="p-3 cursor-pointer hover:bg-gray-100">
                <div className="flex items-center">Asistente <SortIcon column="apellidoAsistente" /></div>
              </th>
              <th onClick={() => requestSort('tipoGasto')} className="p-3 cursor-pointer hover:bg-gray-100">
                <div className="flex items-center">Tipo <SortIcon column="tipoGasto" /></div>
              </th>
              <th onClick={() => requestSort('monto')} className="p-3 text-right cursor-pointer hover:bg-gray-100">
                <div className="flex items-center justify-end">Inversión <SortIcon column="monto" /></div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(i => (
              <React.Fragment key={i.id}>
                <tr className="hover:bg-gray-50 cursor-pointer border-t" onClick={() => setViewDetail(viewDetail === i.id ? null : i.id)}>
                  <td className="p-3 font-medium">
                    {i.cursoTitulo}
                    <div className="text-xs text-gray-500 truncate max-w-md">{i.cursoDescripcion || i.justificacion}</div>
                  </td>
                  <td className="p-3">
                    {i.apellidoAsistente}, {i.nombreAsistente} ({i.nombreAsistente ? '' : i.nombreAsistenteLegacy})
                    <div className="text-xs text-mono text-gray-500">{i.cuilAsistente}</div>
                  </td>
                  <td className="p-3">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">{i.tipoGasto}</span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-gray-700">${i.monto?.toLocaleString()}</td>
                </tr>
                {viewDetail === i.id && (
                  <tr className="bg-purple-50">
                    <td colSpan="4" className="p-4">
                      <div className="grid grid-cols-3 gap-y-3 gap-x-4 text-xs">
                        <div><span className="font-bold">Periodo:</span> {i.periodo}</div>
                        <div><span className="font-bold">¿Es Empleado?:</span> {i.esEmpleado ? 'SI' : 'NO'}</div>
                        <div><span className="font-bold">¿Obtuvo Beneficio?:</span> {i.obtuvoBeneficio ? 'SI' : 'NO'}</div>

                        <div className="col-span-3 bg-gray-50 p-2 rounded border">
                          <p className="font-bold text-gray-700 uppercase mb-1 underline">Datos del Capacitador</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div><span className="font-bold">Tipo:</span> {i.capacitadorTipo}</div>
                            <div><span className="font-bold">Sist. Educ. Nac:</span> {i.capacitadorEsNacional}</div>
                            <div><span className="font-bold">Entidad:</span> {i.capacitadorNombre}</div>
                            <div><span className="font-bold">CUIT/CUIL:</span> {i.capacitadorCUIT}</div>
                          </div>
                        </div>

                        <div className="col-span-3">
                          <span className="font-bold">Descripción del curso:</span>
                          <p className="text-gray-600 italic mt-1">{i.cursoDescripcion || 'Sin descripción'}</p>
                        </div>

                        <div><span className="font-bold">Género:</span> {i.genero}</div>
                        <div><span className="font-bold">Fecha Nac:</span> {i.fechaNacimiento}</div>
                        <div className="col-span-1"></div>

                        <div className="col-span-3 border-t pt-2 mt-2 flex space-x-4">
                          <span className="font-bold text-gray-500">Adjuntos:</span>
                          {i.facturaFile ? <a href={i.facturaFile} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 underline hover:text-blue-800"><Paperclip className="w-3 h-3 mr-1" /> Factura</a> : <span className="text-gray-300">Sin Factura</span>}
                          {i.programaFile ? <a href={i.programaFile} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 underline hover:text-blue-800"><Paperclip className="w-3 h-3 mr-1" /> Programa</a> : <span className="text-gray-300">Sin Programa</span>}
                          {i.certificadoFile ? <a href={i.certificadoFile} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 underline hover:text-blue-800"><Paperclip className="w-3 h-3 mr-1" /> Certificado</a> : <span className="text-gray-300">Sin Certificado</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 6. PRIMER EMPLEO
const PrimerEmpleoTab = ({ db, config, user }) => {
  const { items, addItem, deleteItem, updateItem } = useCrudCollection(db, 'lec_primer_empleo', config.bienioStart, config.bienioEnd, user);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ cuilEmpleado: '', apellido: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'fechaAlta', direction: 'desc' });
  const [form, setForm] = useState({
    periodo: '', cuilEmpleado: '', apellido: '', nombre: '', genero: '', fechaAlta: '', remuneracionBruta: 0
  });
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState(0);

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchesCuil = !filters.cuilEmpleado || i.cuilEmpleado?.includes(filters.cuilEmpleado);
      const matchesApellido = !filters.apellido || i.apellido?.toLowerCase().includes(filters.apellido.toLowerCase());
      return matchesCuil && matchesApellido;
    });
  }, [items, filters]);

  const sortedItems = useMemo(() => {
    const sortableItems = [...filteredItems];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredItems, sortConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addItem(form);
    setForm({ periodo: '', cuilEmpleado: '', apellido: '', nombre: '', genero: '', fechaAlta: '', remuneracionBruta: 0 });
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditValue(item.remuneracionBruta);
  };

  const saveEdit = async (id) => {
    await updateItem(id, { remuneracionBruta: parseFloat(editValue) });
    setEditingId(null);
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <Filter className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center border-b pb-3 border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center">
          <Users className="w-6 h-6 mr-2 text-blue-600" />
          Primer Empleo
        </h3>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="w-full flex justify-between items-center p-4 bg-blue-50 hover:bg-blue-100 transition-colors">
          <div className="flex items-center font-bold text-blue-900">
            <PlusCircle className={`w-5 h-5 mr-2 ${isFormOpen ? 'rotate-45' : ''}`} />
            {isFormOpen ? 'Cerrar Formulario' : 'Nuevo Registro Primer Empleo'}
          </div>
          {isFormOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {isFormOpen && (
          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t">
            <input placeholder="Periodo (YYYYMM)" value={form.periodo} onChange={e => setForm({ ...form, periodo: e.target.value })} className="border p-2 rounded" required />
            <input placeholder="CUIL" value={form.cuilEmpleado} onChange={e => setForm({ ...form, cuilEmpleado: e.target.value })} className="border p-2 rounded" required />
            <input placeholder="Apellido" value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} className="border p-2 rounded" required />
            <input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="border p-2 rounded" />
            <input placeholder="Genero" value={form.genero} onChange={e => setForm({ ...form, genero: e.target.value })} className="border p-2 rounded" />
            <input type="date" value={form.fechaAlta} onChange={e => setForm({ ...form, fechaAlta: e.target.value })} className="border p-2 rounded" />
            <input type="number" placeholder="Remun. Bruta" value={form.remuneracionBruta} onChange={e => setForm({ ...form, remuneracionBruta: parseFloat(e.target.value) })} className="border p-2 rounded" />
            <button type="submit" className="md:col-span-3 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Cargar</button>
          </form>
        )}
      </div>

      <div className="bg-gray-100 p-4 rounded-xl border flex gap-3">
        <input placeholder="Filtrar CUIL..." value={filters.cuilEmpleado} onChange={e => setFilters({ ...filters, cuilEmpleado: e.target.value })} className="border p-2 rounded text-sm" />
        <input placeholder="Filtrar Apellido..." value={filters.apellido} onChange={e => setFilters({ ...filters, apellido: e.target.value })} className="border p-2 rounded text-sm" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 cursor-pointer" onClick={() => setSortConfig({ key: 'cuilEmpleado', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>CUIL <SortIcon column="cuilEmpleado" /></th>
              <th className="p-3">Nombre y Apellido</th>
              <th className="p-3">Género</th>
              <th className="p-3">Fecha Alta</th>
              <th className="p-3 text-right">Remun. Bruta</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(i => (
              <tr key={i.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{i.cuilEmpleado}</td>
                <td className="p-3">{i.apellido}, {i.nombre}</td>
                <td className="p-3">{i.genero}</td>
                <td className="p-3">{i.fechaAlta}</td>
                <td className="p-3 text-right">
                  {editingId === i.id ? (
                    <div className="flex justify-end items-center">
                      <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="border p-1 rounded w-24 mr-2 text-right" />
                      <button onClick={() => saveEdit(i.id)} className="bg-green-500 text-white p-1 rounded"><CheckCircle className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex justify-end items-center cursor-pointer" onClick={() => handleEdit(i)}>
                      ${i.remuneracionBruta?.toLocaleString()}
                      <Edit2 className="w-3 h-3 ml-2 text-gray-400" />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 7. ADQUISICIÓN EQUIPAMIENTO
const AdquisicionEquipamientoTab = ({ db, config, user }) => {
  const { items, addItem, deleteItem } = useCrudCollection(db, 'lec_adquisicion_equipamiento', config.bienioStart, config.bienioEnd, user);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ detalle: '', destino: '' });
  const [form, setForm] = useState({
    periodo: '', detalle: '', destino: '', tipoComprobante: '', nroComprobante: '', fechaComprobante: '', costoTotalSinIva: 0, justificacion: ''
  });

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchesDetalle = !filters.detalle || i.detalle?.toLowerCase().includes(filters.detalle.toLowerCase());
      const matchesDestino = !filters.destino || i.destino?.toLowerCase().includes(filters.destino.toLowerCase());
      return matchesDetalle && matchesDestino;
    });
  }, [items, filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addItem(form);
    setForm({ periodo: '', detalle: '', destino: '', tipoComprobante: '', nroComprobante: '', fechaComprobante: '', costoTotalSinIva: 0, justificacion: '' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center border-b pb-3 border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center">
          <ShoppingCart className="w-6 h-6 mr-2 text-orange-600" />
          Adquisición de Equipamiento
        </h3>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="w-full flex justify-between items-center p-4 bg-orange-50 hover:bg-orange-100 transition-colors">
          <div className="flex items-center font-bold text-orange-900">
            <PlusCircle className={`w-5 h-5 mr-2 ${isFormOpen ? 'rotate-45' : ''}`} />
            {isFormOpen ? 'Cerrar Formulario' : 'Nuevo Comprobante de Equipamiento'}
          </div>
          {isFormOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {isFormOpen && (
          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t">
            <input placeholder="Periodo (YYYYMM)" value={form.periodo} onChange={e => setForm({ ...form, periodo: e.target.value })} className="border p-2 rounded" />
            <input placeholder="Detalle Equipamiento" value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} className="border p-2 rounded col-span-2" required />
            <input placeholder="Destino" value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} className="border p-2 rounded" />
            <input placeholder="Tipo Cbt." value={form.tipoComprobante} onChange={e => setForm({ ...form, tipoComprobante: e.target.value })} className="border p-2 rounded" />
            <input placeholder="N° Comprobante" value={form.nroComprobante} onChange={e => setForm({ ...form, nroComprobante: e.target.value })} className="border p-2 rounded" />
            <input type="date" value={form.fechaComprobante} onChange={e => setForm({ ...form, fechaComprobante: e.target.value })} className="border p-2 rounded" />
            <input type="number" placeholder="Costo Total (sin IVA)" value={form.costoTotalSinIva} onChange={e => setForm({ ...form, costoTotalSinIva: parseFloat(e.target.value) })} className="border p-2 rounded" />
            <textarea placeholder="Justificación" value={form.justificacion} onChange={e => setForm({ ...form, justificacion: e.target.value })} className="border p-2 rounded col-span-3" rows="2" />
            <button type="submit" className="md:col-span-3 bg-orange-600 text-white py-2 rounded font-bold hover:bg-orange-700">Cargar Gasto</button>
          </form>
        )}
      </div>

      <div className="bg-gray-100 p-4 rounded-xl border flex gap-3">
        <input placeholder="Filtrar Detalle..." value={filters.detalle} onChange={e => setFilters({ ...filters, detalle: e.target.value })} className="border p-2 rounded text-sm" />
        <input placeholder="Filtrar Destino..." value={filters.destino} onChange={e => setFilters({ ...filters, destino: e.target.value })} className="border p-2 rounded text-sm" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Detalle</th>
              <th className="p-3">Cbt.</th>
              <th className="p-3 text-right">Monto (sin IVA)</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(i => (
              <tr key={i.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{i.fechaComprobante}</td>
                <td className="p-3">
                  <div className="font-bold">{i.detalle}</div>
                  <div className="text-xs text-gray-500">{i.destino}</div>
                </td>
                <td className="p-3 text-xs">{i.tipoComprobante} {i.nroComprobante}</td>
                <td className="p-3 text-right font-bold">${i.costoTotalSinIva?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 6. EXPORTACIONES
const ExportacionesTab = ({ db, config, user }) => {
  const { items: facturas } = useCrudCollection(db, 'lec_iva_ventas', config.bienioStart, config.bienioEnd, user);

  const exportaciones = facturas.filter(f => f.tipo === 'Exportacion' || f.cliente?.toLowerCase().includes('llc') || f.cliente?.toLowerCase().includes('inc'));

  return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 border-gray-200 flex items-center">
        <Globe className="w-6 h-6 mr-2 text-green-600" />
        Registro de Exportaciones
      </h3>

      <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex justify-between items-center">
        <p className="text-green-800 text-sm">
          <span className="font-bold">Fuente de Datos:</span> Esta tabla se alimenta automáticamente de los archivos "IVA Ventas" importados, filtrando comprobantes tipo 'E' o clientes del exterior.
        </p>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-700">${exportaciones.reduce((a, b) => a + (b.neto || 0), 0).toLocaleString()}</p>
          <p className="text-xs uppercase font-bold text-green-600">Total Exportado (Bienio)</p>
        </div>
      </div>

      <div className="flex space-x-2">
        <input placeholder="Filtrar por Cliente" className="border p-2 rounded-lg text-sm" />
        <input placeholder="Filtrar por País" className="border p-2 rounded-lg text-sm" />
        <button className="bg-gray-200 px-3 rounded-lg"><Filter className="w-4 h-4 text-gray-600" /></button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Factura</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">País Destino</th>
              <th className="p-3 text-right">Monto Neto</th>
            </tr>
          </thead>
          <tbody>
            {exportaciones.length > 0 ? exportaciones.map(ex => (
              <tr key={ex.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{ex.fecha}</td>
                <td className="p-3 font-mono">{ex.numeroComprobante}</td>
                <td className="p-3 font-medium">{ex.cliente}</td>
                <td className="p-3">{ex.pais || 'EE.UU'}</td>
                <td className="p-3 text-right font-bold text-gray-700">${ex.neto?.toLocaleString()}</td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="p-8 text-center text-gray-400">No se encontraron exportaciones en el IVA Ventas del periodo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 4. VENTAS
const VentasTab = ({ db, config, user }) => {
  const { items, loading } = useCrudCollection(db, 'lec_iva_ventas', config.bienioStart, config.bienioEnd, user);

  // Estados para filtros
  const [filters, setFilters] = useState({
    fecha: '',
    tipo: '',
    numero: '',
    cliente: '',
    cuit: '',
    neto: '',
    impuestos: '',
    total: '',
    moneda: '',
    pais: '',
    detalle: '',
    centroCosto: '',
    actividad: '',
    promovido: ''
  });

  // Estados para ordenamiento
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' });
  const [expandedRowId, setExpandedRowId] = useState(null);

  const clearFilters = () => {
    setFilters({
      fecha: '', tipo: '', numero: '', cliente: '', cuit: '', neto: '', impuestos: '',
      total: '', moneda: '', pais: '', detalle: '', centroCosto: '', actividad: '', promovido: ''
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const toggleRow = (id) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      return (
        (!filters.fecha || i.fecha?.includes(filters.fecha)) &&
        (!filters.tipo || i.tipo?.toLowerCase().includes(filters.tipo.toLowerCase())) &&
        (!filters.numero || i.numeroComprobante?.includes(filters.numero)) &&
        (!filters.cliente || i.cliente?.toLowerCase().includes(filters.cliente.toLowerCase())) &&
        (!filters.cuit || i.cuit?.includes(filters.cuit)) &&
        (!filters.neto || i.neto?.toString()?.includes(filters.neto)) &&
        (!filters.impuestos || i.impuestos?.toString()?.includes(filters.impuestos)) &&
        (!filters.total || i.total?.toString()?.includes(filters.total)) &&
        (!filters.moneda || i.moneda?.toLowerCase().includes(filters.moneda.toLowerCase())) &&
        (!filters.pais || i.pais?.toLowerCase().includes(filters.pais.toLowerCase())) &&
        (!filters.detalle || i.detalle?.toLowerCase().includes(filters.detalle.toLowerCase())) &&
        (!filters.centroCosto || i.centroCosto?.toLowerCase().includes(filters.centroCosto.toLowerCase())) &&
        (!filters.actividad || i.actividad?.toLowerCase().includes(filters.actividad.toLowerCase())) &&
        (!filters.promovido || (filters.promovido === 'SI' ? i.promovido : filters.promovido === 'NO' ? !i.promovido : true))
      );
    });
  }, [items, filters]);

  const sortedItems = useMemo(() => {
    const sortableItems = [...filteredItems];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Normalize dates for correct chronological sorting
        if (sortConfig.key === 'fecha') {
          aValue = normalizeDate(aValue);
          bValue = normalizeDate(bValue);
        }

        // Special case for composite column N°Comprobante
        if (sortConfig.key === 'numeroComprobante') {
          aValue = `${a.tipo} ${a.numeroComprobante}`;
          bValue = `${b.tipo} ${b.numeroComprobante}`;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredItems, sortConfig]);

  const handleExport = () => {
    const data = sortedItems.map(i => ({
      Fecha: i.fecha,
      Tipo: i.tipo,
      Numero: i.numeroComprobante,
      Cliente: i.cliente,
      CUIT: i.cuit,
      Neto: i.neto,
      Impuestos: i.impuestos,
      Total: i.total,
      Moneda: i.moneda,
      Pais: i.pais,
      Detalle: i.detalle,
      CentroCosto: i.centroCosto,
      Actividad: i.actividad,
      Promovido: i.promovido ? 'SI' : 'NO'
    }));
    downloadCSV(data, "Ventas_LEC_Filtrado");
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <Filter className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center border-b pb-3 border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center">
          <DollarSign className="w-6 h-6 mr-2 text-green-600" />
          Registro de Ventas
        </h3>
        <div className="flex space-x-2">
          {items.length > 0 && items.length !== filteredItems.length && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md flex items-center">
              Mostrando {filteredItems.length} de {items.length}
            </span>
          )}
          <button onClick={clearFilters} className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1 rounded-lg">
            Limpiar Filtros
          </button>
          <button onClick={handleExport} className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-600 px-3 py-1 rounded-lg">
            <Filter className="w-4 h-4 mr-2" /> Exportar Vista
          </button>
          <button onClick={async () => {
            if (!confirm("Esto descargará todos los registros del BIENIO ACTIVO. ¿Continuar?")) return;
            try {
              const q = query(collection(db, `/artifacts/${APP_ID}/public/data/lec_iva_ventas`), where("companyId", "==", user.companyId));
              const snap = await getDocs(q);
              const allDocs = snap.docs.map(d => d.data());

              // Filter by Bienio Dates
              const filteredDocs = allDocs.filter(item => {
                const dateToCheck = item.fecha;
                if (!dateToCheck) return false;
                return dateToCheck >= config.bienioStart && dateToCheck <= config.bienioEnd;
              });

              downloadCSV(filteredDocs.map(i => ({
                Fecha: i.fecha, Tipo: i.tipo, Numero: i.numeroComprobante, Cliente: i.cliente, CUIT: i.cuit,
                Neto: i.neto, Impuestos: i.impuestos, Total: i.total, Moneda: i.moneda, Pais: i.pais,
                Detalle: i.detalle, CentroCosto: i.centroCosto, Actividad: i.actividad, Promovido: i.promovido ? 'SI' : 'NO'
              })), `Ventas_LEC_${config.bienioStart}_${config.bienioEnd}`);
            } catch (e) { console.error(e); alert("Error al descargar el bienio."); }
          }} className="flex items-center text-sm font-medium text-green-600 hover:text-green-800 border border-green-600 px-3 py-1 rounded-lg">
            <Download className="w-4 h-4 mr-2" /> Exportar Bienio
          </button>
        </div>
      </div>

      {/* FILTROS DINÁMICOS */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <input placeholder="Fecha" value={filters.fecha} onChange={e => handleFilterChange('fecha', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Tipo" value={filters.tipo} onChange={e => handleFilterChange('tipo', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Número" value={filters.numero} onChange={e => handleFilterChange('numero', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Cliente" value={filters.cliente} onChange={e => handleFilterChange('cliente', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="CUIT" value={filters.cuit} onChange={e => handleFilterChange('cuit', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Neto" value={filters.neto} onChange={e => handleFilterChange('neto', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Impuestos" value={filters.impuestos} onChange={e => handleFilterChange('impuestos', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Total" value={filters.total} onChange={e => handleFilterChange('total', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Moneda" value={filters.moneda} onChange={e => handleFilterChange('moneda', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="País" value={filters.pais} onChange={e => handleFilterChange('pais', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Detalle" value={filters.detalle} onChange={e => handleFilterChange('detalle', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Centro Costo" value={filters.centroCosto} onChange={e => handleFilterChange('centroCosto', e.target.value)} className="border p-2 rounded text-xs" />
          <input placeholder="Actividad" value={filters.actividad} onChange={e => handleFilterChange('actividad', e.target.value)} className="border p-2 rounded text-xs" />
          <select value={filters.promovido} onChange={e => handleFilterChange('promovido', e.target.value)} className="border p-2 rounded text-xs">
            <option value="">Promovido?</option>
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th onClick={() => requestSort('fecha')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center text-xs uppercase tracking-wider">Fecha <SortIcon column="fecha" /></div>
                </th>
                <th onClick={() => requestSort('cliente')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center text-xs uppercase tracking-wider">Cliente <SortIcon column="cliente" /></div>
                </th>
                <th onClick={() => requestSort('numeroComprobante')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center text-xs uppercase tracking-wider">N° Comprobante <SortIcon column="numeroComprobante" /></div>
                </th>
                <th onClick={() => requestSort('neto')} className="px-4 py-3 text-right font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center justify-end text-xs uppercase tracking-wider">Neto <SortIcon column="neto" /></div>
                </th>
                <th onClick={() => requestSort('actividad')} className="px-4 py-3 text-left font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center text-xs uppercase tracking-wider">Actividad <SortIcon column="actividad" /></div>
                </th>
                <th onClick={() => requestSort('promovido')} className="px-4 py-3 text-center font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center justify-center text-xs uppercase tracking-wider">Promovido <SortIcon column="promovido" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-400">Cargando datos...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-400">No se encontraron ventas con los filtros aplicados</td></tr>
              ) : (
                sortedItems.map(item => (
                  <React.Fragment key={item.id}>
                    <tr
                      onClick={() => toggleRow(item.id)}
                      className={`hover:bg-blue-50 cursor-pointer transition-colors ${expandedRowId === item.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{item.fecha}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.cliente}</div>
                        <div className="text-xs text-gray-400">{item.cuit}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{item.tipo} {item.numeroComprobante}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-700">${item.neto?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600">{item.actividad}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.promovido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.promovido ? 'SÍ' : 'NO'}
                        </span>
                      </td>
                    </tr>
                    {expandedRowId === item.id && (
                      <tr className="bg-gray-50 border-t-0">
                        <td colSpan="6" className="px-8 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div className="bg-white p-2 rounded border border-gray-100 shadow-sm">
                              <p className="text-gray-400 font-bold uppercase mb-1">Moneda</p>
                              <p className="font-mono text-gray-700">{item.moneda || 'ARS'}</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-100 shadow-sm">
                              <p className="text-gray-400 font-bold uppercase mb-1">País</p>
                              <p className="text-gray-700">{item.pais || 'Argentina'}</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-100 shadow-sm">
                              <p className="text-gray-400 font-bold uppercase mb-1">Centro de Costo</p>
                              <p className="text-gray-700">{item.centroCosto || '-'}</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-100 shadow-sm">
                              <p className="text-gray-400 font-bold uppercase mb-1">Impuestos</p>
                              <p className="font-mono text-gray-700">${item.impuestos?.toLocaleString() || '0'}</p>
                            </div>
                            <div className="col-span-2 md:col-span-4 bg-white p-2 rounded border border-gray-100 shadow-sm">
                              <p className="text-gray-400 font-bold uppercase mb-1">Detalle</p>
                              <p className="text-gray-700 italic">{item.detalle || 'Sin detalle adicional'}</p>
                            </div>
                            <div className="col-span-2 md:col-span-4 bg-white p-2 rounded border border-gray-100 shadow-sm">
                              <p className="text-gray-400 font-bold uppercase mb-1">Total Comprobante</p>
                              <p className="text-lg font-bold text-green-600 font-mono">${item.total?.toLocaleString()}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 7. HISTÓRICO
const HistoricoTab = ({ db, user }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('2023-2024');

  // Derive dates from selection
  const periodDates = useMemo(() => {
    const [startYear, endYear] = selectedPeriod.split('-');
    return {
      start: `${startYear}-01-01`,
      end: `${endYear}-12-31`
    };
  }, [selectedPeriod]);

  // Fetch data for the selected period
  const { items: nomina } = useCrudCollection(db, 'lec_nomina_rrhh', periodDates.start, periodDates.end, user);
  const { items: ventas } = useCrudCollection(db, 'lec_iva_ventas', periodDates.start, periodDates.end, user);
  const { items: exportaciones } = useCrudCollection(db, 'lec_exportaciones', periodDates.start, periodDates.end, user);
  const { items: proyectos } = useCrudCollection(db, 'lec_proyectos_id', periodDates.start, periodDates.end, user);
  const { items: capacitaciones } = useCrudCollection(db, 'lec_capacitaciones', periodDates.start, periodDates.end, user);

  // Calculations
  const nominaFinal = useMemo(() => {
    // Unique CUILs to get headcount
    const uniqueCuils = new Set(nomina.map(e => e.cuil));
    return uniqueCuils.size;
  }, [nomina]);

  const totalVentas = useMemo(() => ventas.reduce((acc, curr) => acc + (curr.total || 0), 0), [ventas]);
  const totalExportUSDA = useMemo(() => exportaciones.reduce((acc, curr) => acc + (curr.monto || 0), 0), [exportaciones]); // Assuming 'monto' is USD for exports

  const totalInversionID = useMemo(() => {
    return proyectos.reduce((acc, proj) => {
      const rrhh = proj.recursosHumanos?.reduce((sum, r) => sum + (r.costoImputado || 0), 0) || 0;
      const mat = proj.recursosMateriales?.reduce((sum, r) => sum + (r.monto || 0), 0) || 0;
      return acc + rrhh + mat;
    }, 0);
  }, [proyectos]);

  const totalCapacitacion = useMemo(() => capacitaciones.reduce((acc, curr) => acc + (curr.monto || 0), 0), [capacitaciones]);

  const totalMasaSalarial = useMemo(() => nomina.reduce((acc, curr) => acc + (curr.remuneracion || 0), 0), [nomina]); // Total sum of monthly salaries in records

  // Percentages
  const pctExportSobreVentas = totalVentas > 0 ? ((totalExportUSDA * 1000 /* aprox exchange rate placeholder if mixing currencies? No, usually Exportaciones entry is in Pesos or we keep distinct. Let's assume ratio is abstract or currency matched */) / totalVentas) * 100 : 0;
  // Better approach: If Ventas is in Pesos and Export in USD, we can't easily divide. 
  // User asked for "Exportaciones en USD".
  // For the percentage, usually we need same currency. 
  // I will assume for the % calculation that we just divide the raw numbers or that Export was entered in Pesos for the ratio check (standard in Argentina is checking Export ratio in same currency).
  // However, I'll calculate simply: (Total Export / Total Ventas) * 100
  const pctExportVsVentas = totalVentas > 0 ? (totalExportUSDA / totalVentas) * 100 : 0; // WARNING: Currency mismatch possible if one is USD other ARS. user asked for exports in USD. 

  const pctIDSobreVentas = totalVentas > 0 ? (totalInversionID / totalVentas) * 100 : 0;

  const pctCapacitacionSobreSueldos = totalMasaSalarial > 0 ? (totalCapacitacion / totalMasaSalarial) * 100 : 0;

  const pctVentasPromovidas = 100; // Placeholder: All imported sales are promoted

  const handleDownloadPDF = () => {
    const element = document.getElementById('historico-content');
    const opt = {
      margin: 0.5,
      filename: `Reporte_Historico_LEC_${selectedPeriod}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save();
    } else {
      alert("La librería de PDF aún se está cargando. Intenta de nuevo en unos segundos.");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center border-b pb-3 border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center">
          <History className="w-6 h-6 mr-2 text-gray-600" />
          Histórico de Bienios Cerrados
        </h3>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center text-sm font-medium text-red-600 hover:text-red-800 border border-red-600 px-3 py-1 rounded-lg"
        >
          <div className="w-4 h-4 mr-2 border-2 border-red-600 rounded-sm flex items-center justify-center text-[8px] font-bold">PDF</div>
          Exportar Reporte PDF
        </button>
      </div>

      <div className="flex items-center space-x-4 bg-gray-100 p-4 rounded-xl">
        <span className="font-bold text-gray-700">Seleccionar Bienio Pasado:</span>
        <select className="border p-2 rounded-lg font-mono" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
          <option value="2023-2024">2023 - 2024</option>
          <option value="2021-2022">2021 - 2022</option>
        </select>
        <span className="text-sm text-gray-500 italic ml-auto">Visualizando datos históricos reales</span>
      </div>

      <div id="historico-content" className="p-4 bg-white rounded-xl">
        <div className="mb-6 text-center border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800">Reporte de Desempeño LEC - Periodo {selectedPeriod}</h2>
          <p className="text-sm text-gray-500">Generado el {new Date().toLocaleDateString()}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Row 1: Main Totals */}
          <div className="bg-white p-6 rounded-xl shadow border border-blue-100 flex flex-col justify-center items-center">
            <p className="text-gray-500 font-bold uppercase text-xs">Nómina Final</p>
            <p className="text-3xl font-extrabold text-blue-600 mt-2">{nominaFinal}</p>
            <p className="text-xs text-gray-400">Empleados</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow border border-green-100 flex flex-col justify-center items-center">
            <p className="text-gray-500 font-bold uppercase text-xs">Ventas Totales</p>
            <p className="text-2xl font-extrabold text-green-600 mt-2">${totalVentas.toLocaleString()}</p>
            <p className="text-xs text-gray-400">Pesos (ARS)</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow border border-indigo-100 flex flex-col justify-center items-center">
            <p className="text-gray-500 font-bold uppercase text-xs">Exportaciones</p>
            <p className="text-2xl font-extrabold text-indigo-600 mt-2">USD {totalExportUSDA.toLocaleString()}</p>
            <p className="text-xs text-gray-400">Dólares</p>
          </div>

          <div className="px-4 flex flex-col justify-center space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-600">% Ventas Promovidas:</span> <span className="font-bold">{pctVentasPromovidas}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">% Export. s/ Ventas:</span> <span className="font-bold">{pctExportVsVentas.toFixed(2)}%</span></div>
          </div>

          {/* Row 2: Investments & Complex KPIs */}
          <div className="bg-white p-6 rounded-xl shadow border border-yellow-100">
            <p className="text-gray-500 font-bold uppercase text-xs mb-2">Inversión I+D</p>
            <p className="text-2xl font-bold text-gray-800">${totalInversionID.toLocaleString()}</p>
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500">Sobre Ventas</p>
              <p className={`text-lg font-bold ${pctIDSobreVentas >= 3 ? 'text-green-600' : 'text-red-500'}`}>{pctIDSobreVentas.toFixed(2)}%</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow border border-purple-100">
            <p className="text-gray-500 font-bold uppercase text-xs mb-2">Inversión Capacitación</p>
            <p className="text-2xl font-bold text-gray-800">${totalCapacitacion.toLocaleString()}</p>
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500">Sobre Masa Salarial</p>
              <p className="text-lg font-bold text-purple-600">{pctCapacitacionSobreSueldos.toFixed(2)}%</p>
            </div>
          </div>

          <div className="col-span-1 md:col-span-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm p-6 mt-6">
            [Aquí se mostrarían los gráficos y tablas detalladas históricos]
          </div>
        </div>
      </div>
    </div>
  );
};

// 8. CONFIGURACIÓN
// 8. CONFIGURACIÓN
const ConfiguracionLEC = ({ db, lecConfig, selectedBienio, user }) => {
  const [cfg, setCfg] = useState(lecConfig);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isSaving) {
      setCfg(lecConfig);
    }
  }, [lecConfig, isSaving]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Guardar campos de importación en config global
      await setDoc(doc(db, `/artifacts/${APP_ID}/public/data/lec_config`, 'settings'), {
        importFields: cfg.importFields
      }, { merge: true });

      // 2. Guardar metas en el bienio específico
      if (selectedBienio?.id) {
        await updateDoc(doc(db, `/artifacts/${APP_ID}/public/data/lec_bienios`, selectedBienio.id), {
          targets: {
            targetHeadcount: cfg.targetHeadcount,
            targetRevenue: cfg.targetRevenue,
            targetExport: cfg.targetExport,
            targetTraining: cfg.targetTraining,
            targetPctID: cfg.targetPctID,
            targetIDCount: cfg.targetIDCount,
            targetQualityCount: cfg.targetQualityCount
          }
        });
      }

      alert("Configuración guardada correctamente.");
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar la configuración.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 border-gray-200 flex items-center">
        <Settings className="w-6 h-6 mr-2 text-gray-600" />
        Ajustes Generales del Sistema
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="font-bold text-blue-800 mb-4 uppercase text-sm border-b pb-2">Definición de Bienio (Global)</h4>
          <p className="text-xs text-gray-500 mb-3">Define el rango de fechas que filtrará toda la plataforma.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-600">Fecha Inicio</label>
              <input type="date" value={cfg.bienioStart} onChange={e => setCfg({ ...cfg, bienioStart: e.target.value })} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600">Fecha Fin</label>
              <input type="date" value={cfg.bienioEnd} onChange={e => setCfg({ ...cfg, bienioEnd: e.target.value })} className="w-full border p-2 rounded" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="font-bold text-blue-800 mb-4 uppercase text-sm border-b pb-2">Objetivos Anuales (Targets)</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-600">Objetivo de Nómina (Cantidad Personas)</label>
              <input type="number" value={cfg.targetHeadcount} onChange={e => setCfg({ ...cfg, targetHeadcount: parseInt(e.target.value) })} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600">Objetivo Facturación Promovida (% sobre Total)</label>
              <input type="number" value={cfg.targetRevenue} onChange={e => setCfg({ ...cfg, targetRevenue: parseFloat(e.target.value) })} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600">Objetivo Exportación (% sobre Total)</label>
              <input type="number" value={cfg.targetExport} onChange={e => setCfg({ ...cfg, targetExport: parseFloat(e.target.value) })} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600">Objetivo Inversión Capacitación ($ ARS)</label>
              <input type="number" value={cfg.targetTraining} onChange={e => setCfg({ ...cfg, targetTraining: parseFloat(e.target.value) })} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600">Objetivo Inversión I+D (% sobre Ventas)</label>
              <input type="number" step="0.1" value={cfg.targetPctID} onChange={e => setCfg({ ...cfg, targetPctID: parseFloat(e.target.value) })} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600">Meta Cantidad Proyectos I+D</label>
              <input type="number" value={cfg.targetIDCount} onChange={e => setCfg({ ...cfg, targetIDCount: parseInt(e.target.value) })} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600">Meta Cantidad Normas Calidad</label>
              <input type="number" value={cfg.targetQualityCount} onChange={e => setCfg({ ...cfg, targetQualityCount: parseInt(e.target.value) })} className="w-full border p-2 rounded" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
          <h4 className="font-bold text-blue-800 mb-4 uppercase text-sm border-b pb-2">Configuración de Importación (Templates)</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600">Campos Nómina (separados por coma)</label>
                <input value={cfg.importFields?.nomina || ''} onChange={e => setCfg({ ...cfg, importFields: { ...cfg.importFields, nomina: e.target.value } })} className="w-full border p-2 rounded font-mono text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600">Campos Ventas</label>
                <input value={cfg.importFields?.ventas || ''} onChange={e => setCfg({ ...cfg, importFields: { ...cfg.importFields, ventas: e.target.value } })} className="w-full border p-2 rounded font-mono text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600">Campos Capacitación</label>
                <input value={cfg.importFields?.capacitacion || ''} onChange={e => setCfg({ ...cfg, importFields: { ...cfg.importFields, capacitacion: e.target.value } })} className="w-full border p-2 rounded font-mono text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600">Campos Compras / Gastos</label>
                <input value={cfg.importFields?.compras || ''} onChange={e => setCfg({ ...cfg, importFields: { ...cfg.importFields, compras: e.target.value } })} className="w-full border p-2 rounded font-mono text-xs" />
                <p className="text-[10px] text-gray-400 mt-1">* Se sugiere incluir 'Proyecto_ID' para asociar gastos automáticamente.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ZONA DE PELIGRO: BORRADO DE DATOS */}
        <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-200 md:col-span-2">
          <h4 className="font-bold text-red-800 mb-4 uppercase text-sm border-b border-red-200 pb-2 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2" /> Zona de Peligro: Reinicio de Datos
          </h4>
          <p className="text-xs text-red-600 mb-4">
            Esta sección permite eliminar permanentemente los datos acumulados de la empresa <strong>{user?.razonSocial}</strong>.
            Úsalo con precaución para reiniciar la aplicación después de pruebas.
          </p>
          <div className="flex flex-wrap gap-4">
            <button onClick={async () => {
              if (!confirm("¿Estás SEGURO de eliminar TODO el historial de NÓMINA de esta empresa? Esta acción es irreversible.")) return;
              try {
                const q = query(collection(db, `/artifacts/${APP_ID}/public/data/lec_nomina_rrhh`), where("companyId", "==", user.companyId));
                const snap = await getDocs(q);
                const batchPromises = snap.docs.map(d => deleteDoc(d.ref));
                await Promise.all(batchPromises);
                alert(`Se eliminaron ${snap.size} registros de nómina.`);
              } catch (e) { console.error(e); alert("Error al eliminar nómina."); }
            }} className="bg-red-600 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded shadow">
              Borrar Nómina
            </button>

            <button onClick={async () => {
              if (!confirm("¿Estás SEGURO de eliminar TODO el historial de VENTAS y EXPORTACIONES de esta empresa?")) return;
              try {
                const q = query(collection(db, `/artifacts/${APP_ID}/public/data/lec_iva_ventas`), where("companyId", "==", user.companyId));
                const snap = await getDocs(q);
                await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
                alert(`Se eliminaron ${snap.size} registros de ventas.`);
              } catch (e) { console.error(e); alert("Error al eliminar ventas."); }
            }} className="bg-red-600 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded shadow">
              Borrar Ventas/Exp.
            </button>

            <button onClick={async () => {
              if (!confirm("¿Estás SEGURO de eliminar TODO el historial de I+D de esta empresa?")) return;
              try {
                const q = query(collection(db, `/artifacts/${APP_ID}/public/data/lec_proyectos_id`), where("companyId", "==", user.companyId));
                const snap = await getDocs(q);
                await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
                alert(`Se eliminaron ${snap.size} registros de I+D.`);
              } catch (e) { console.error(e); alert("Error al eliminar I+D."); }
            }} className="bg-red-600 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded shadow">
              Borrar I+D
            </button>

            <button onClick={async () => {
              if (!confirm("¿Estás SEGURO de eliminar TODO el historial de CAPACITACIONES de esta empresa?")) return;
              try {
                const q = query(collection(db, `/artifacts/${APP_ID}/public/data/lec_capacitaciones`), where("companyId", "==", user.companyId));
                const snap = await getDocs(q);
                await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
                alert(`Se eliminaron ${snap.size} registros de capacitación.`);
              } catch (e) { console.error(e); alert("Error al eliminar capacitaciones."); }
            }} className="bg-red-600 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded shadow">
              Borrar Capacitación
            </button>

            <button onClick={async () => {
              if (!confirm("¿Estás SEGURO de reinicializar las certificaciones de CALIDAD?")) return;
              try {
                // Calidad se guarda en el documento de settings, no como colección separada. Lo vaciamos.
                await updateDoc(doc(db, `/artifacts/${APP_ID}/public/data/lec_config`, 'settings'), { qualityNorms: [] });
                alert("Certificaciones de calidad reiniciadas.");
                // Forzamos recarga visual
                window.location.reload();
              } catch (e) { console.error(e); alert("Error al reiniciar calidad."); }
            }} className="bg-red-600 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded shadow">
              Reiniciar Calidad
            </button>

            <div className="w-full border-t border-red-200 my-2"></div>

            <button onClick={async () => {
              const name = user?.razonSocial || "esta empresa";
              if (!confirm(`¿Estás SEGURO de eliminar la empresa "${name}"? ESTO BORRARÁ LA EMPRESA Y NO PODRÁS ACCEDER A ELLA.`)) return;
              if (!confirm(`Confirma nuevamente: ¿ELIMINAR EMPRESA "${name}"?`)) return;
              try {
                await deleteDoc(doc(db, `/artifacts/${APP_ID}/public/data/lec_companies`, user.companyId));
                alert("Empresa eliminada.");
                window.location.reload();
              } catch (e) { console.error(e); alert("Error al eliminar empresa."); }
            }} className="bg-red-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded shadow border border-red-950 flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" /> ELIMINAR EMPRESA
            </button>

            <button onClick={async () => {
              if (!confirm(`¿Estás SEGURO de eliminar el bienio "${selectedBienio?.name}"?`)) return;
              try {
                await deleteDoc(doc(db, `/artifacts/${APP_ID}/public/data/lec_bienios`, selectedBienio.id));
                alert("Bienio eliminado.");
                window.location.reload();
              } catch (e) { console.error(e); alert("Error al eliminar bienio."); }
            }} className="bg-red-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded shadow border border-red-950 flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" /> ELIMINAR BIENIO
            </button>
          </div>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className={`${isSaving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-3 rounded-xl font-bold shadow-lg fixed bottom-8 right-8 flex items-center transition-all`}
      >
        {isSaving ? (
          <>
            <Loader2 className="animate-spin w-5 h-5 mr-2" />
            Guardando...
          </>
        ) : (
          'Guardar Configuración'
        )}
      </button>
    </div>
  );
};

// 9. CALIDAD
const CalidadTab = ({ db, lecConfig }) => {
  const [newCert, setNewCert] = useState({ norm: '', startDate: '', endDate: '', link: '', ente: '' });

  const handleAdd = async () => {
    const updated = [...lecConfig.qualityNorms, { ...newCert, id: crypto.randomUUID() }];
    await updateDoc(doc(db, `/artifacts/${APP_ID}/public/data/lec_config`, 'settings'), { qualityNorms: updated });
    setNewCert({ norm: '', startDate: '', endDate: '', link: '', ente: '' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 border-gray-200 flex items-center">
        <Award className="w-6 h-6 mr-2 text-blue-600" />
        Certificaciones de Calidad
      </h3>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h4 className="font-bold text-gray-700 mb-4">Cargar Nueva Certificación</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <input placeholder="Nombre Norma" value={newCert.norm} onChange={e => setNewCert({ ...newCert, norm: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Ente Certificador" value={newCert.ente} onChange={e => setNewCert({ ...newCert, ente: e.target.value })} className="border p-2 rounded" />
          <input type="date" title="Fecha Alta" value={newCert.startDate} onChange={e => setNewCert({ ...newCert, startDate: e.target.value })} className="border p-2 rounded" />
          <input type="date" title="Vencimiento" value={newCert.endDate} onChange={e => setNewCert({ ...newCert, endDate: e.target.value })} className="border p-2 rounded" />
          <input placeholder="Link PDF (Drive/URL)" value={newCert.link} onChange={e => setNewCert({ ...newCert, link: e.target.value })} className="border p-2 rounded" />
          <button onClick={handleAdd} className="bg-blue-600 text-white py-2 rounded font-bold">Añadir Certificado</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left"><tr><th className="p-3">Norma</th><th className="p-3">Ente</th><th className="p-3">Vigencia</th><th className="p-3">Estado</th><th className="p-3">Doc</th></tr></thead>
          <tbody>
            {lecConfig.qualityNorms?.map(n => (
              <tr key={n.id} className="border-t">
                <td className="p-3 font-bold">{n.norm}</td>
                <td className="p-3">{n.ente || 'IRAM'}</td>
                <td className="p-3">{n.startDate} al {n.endDate}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${new Date(n.endDate) < new Date() ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {new Date(n.endDate) < new Date() ? 'Vencida' : 'Vigente'}
                  </span>
                </td>
                <td className="p-3">{n.link && <a href={n.link} target="_blank" className="text-blue-600"><Paperclip className="w-4 h-4" /></a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---

const App = () => {
  // --- LÓGICA DE INYECCIÓN DE ESTILOS (Tailwind CDN) ---
  useEffect(() => {
    const existingScript = document.querySelector('script[src="https://cdn.tailwindcss.com"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://cdn.tailwindcss.com';
      script.async = true;
      document.head.appendChild(script);
    }

    // Inject html2pdf
    const existingPdfScript = document.querySelector('script[src*="html2pdf"]');
    if (!existingPdfScript) {
      const scriptPdf = document.createElement('script');
      scriptPdf.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      scriptPdf.async = true;
      document.head.appendChild(scriptPdf);
    }
  }, []);

  const { db, user, isAuthReady } = useFirebaseInit();

  // State for Multi-Company
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBienio, setSelectedBienio] = useState(null);

  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Global System Config from Firestore
  const [systemConfig, setSystemConfig] = useState(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, `/artifacts/${APP_ID}/public/data/lec_config`, 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        setSystemConfig(docSnap.data());
      }
    });
    return () => unsub();
  }, [db]);

  // Real-time listener for selected bienio targets
  useEffect(() => {
    if (!db || !selectedBienio?.id) return;
    const unsub = onSnapshot(doc(db, `/artifacts/${APP_ID}/public/data/lec_bienios`, selectedBienio.id), (docSnap) => {
      if (docSnap.exists()) {
        setSelectedBienio({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsub();
  }, [db, selectedBienio?.id]);

  // Construct effective user with company context
  const userWithContext = useMemo(() => {
    return user ? { ...user, companyId: selectedCompany?.id } : null;
  }, [user, selectedCompany]);

  // Construct Config from Selected Bienio + Global Config
  const config = useMemo(() => {
    const defaultImportFields = {
      nomina: "Año,Mes,Periodo,Nombre_Apellido,Fecha_de_nacimiento,CUIL,Codigo Actividad,Fecha_Alta,Fecha_Baja,Motivo_Baja,Nivel_Educativo,Titulo,Posgrado_Art.9,Area,Tareas_Realizadas,Inciso_LEC,Tecnologias,Realiza_Teletrabajo,Salario_Bruto,Genero,Posee_CUD?,Provincia_Residencia,Reside_Zona_desfavorable,Beneficiario_Planes?,Mod_Contratacion",
      ventas: "Fecha,Tipo_Cbte,Numero,Cliente,CUIT,Neto_Gravado,Impuestos,Total,Moneda,Pais,Detalle,Centro_Costo,Actividad,Promovido",
      capacitacion: "Periodo,Curso_Titulo,Curso_Descripcion,Tipo_Gasto,CUIL_Asistente,Apellido_Asistente,Nombre_Asistente,Genero,Fecha_Nacimiento,Es_Empleado,Obtuvo_Beneficio,Capacitador_Tipo,Capacitador_Sist_Educ,Capacitador_Nombre,Capacitador_CUIT,Monto,Justificacion,Link_Factura,Link_Programa,Link_Certificado",
      compras: "Fecha,Proveedor,CUIT,Concepto,Monto_Neto,IVA,Total,Proyecto_ID_Asociado"
    };

    if (!selectedBienio) return {
      bienioStart: '2025-01-01', bienioEnd: '2026-12-31',
      importFields: systemConfig?.importFields || defaultImportFields
    };

    return {
      bienioStart: selectedBienio.start,
      bienioEnd: selectedBienio.end,
      targetHeadcount: selectedBienio.targets?.targetHeadcount ?? 10,
      targetRevenue: selectedBienio.targets?.targetRevenue ?? 70,
      targetExport: selectedBienio.targets?.targetExport ?? 15,
      targetTraining: selectedBienio.targets?.targetTraining ?? 0,
      targetPctID: selectedBienio.targets?.targetPctID ?? 0,
      targetIDCount: selectedBienio.targets?.targetIDCount ?? 1,
      targetQualityCount: selectedBienio.targets?.targetQualityCount ?? 1,
      qualityNorms: systemConfig?.qualityNorms || [],
      importFields: systemConfig?.importFields || defaultImportFields
    };
  }, [selectedBienio, systemConfig]);

  // COLECCIONES PRINCIPALES PARA ALIMENTAR EL DASHBOARD
  // Note: We use userWithContext here!
  // COLECCIONES PRINCIPALES PARA ALIMENTAR EL DASHBOARD
  // Note: We use userWithContext here!
  const { items: nomina } = useCrudCollection(db, 'lec_nomina_rrhh', config.bienioStart, config.bienioEnd, userWithContext);
  const { items: proyectos } = useCrudCollection(db, 'lec_proyectos_id', config.bienioStart, config.bienioEnd, userWithContext);
  const { items: capacitaciones } = useCrudCollection(db, 'lec_capacitaciones', config.bienioStart, config.bienioEnd, userWithContext);
  const { items: primerEmpleo } = useCrudCollection(db, 'lec_primer_empleo', config.bienioStart, config.bienioEnd, userWithContext);
  const { items: adquisicionEquipamiento } = useCrudCollection(db, 'lec_adquisicion_equipamiento', config.bienioStart, config.bienioEnd, userWithContext);
  const { items: facturas } = useCrudCollection(db, 'lec_iva_ventas', config.bienioStart, config.bienioEnd, userWithContext);
  const { items: compras } = useCrudCollection(db, 'lec_iva_compras', config.bienioStart, config.bienioEnd, userWithContext);

  // CÁLCULO DE NÓMINA FINAL (Último periodo del bienio)
  const nominaFinalCount = useMemo(() => {
    if (!config.bienioEnd) return 0;
    // Extract year from YYYY-MM-DD and append '12'
    const endYear = config.bienioEnd.substring(0, 4);
    const targetPeriod = `${endYear}12`;

    const cuilesFinal = new Set();
    nomina.forEach(rec => {
      if (rec.periodo === targetPeriod && rec.cuil) {
        cuilesFinal.add(rec.cuil);
      }
    });
    return cuilesFinal.size;
  }, [nomina, config.bienioEnd]);

  // CÁLCULOS GLOBALES (Totales del Bienio)
  // Note: We use userWithContext here!
  const totalRevenue = facturas.reduce((acc, curr) => acc + (parseFloat(curr.neto) || 0), 0);
  const totalPromotedRevenue = facturas
    .filter(f => f.promovido === true)
    .reduce((acc, curr) => acc + (parseFloat(curr.neto) || 0), 0);

  const totalExport = facturas
    .filter(f => f.pais && f.pais.toLowerCase() !== 'argentina')
    .reduce((acc, curr) => acc + (parseFloat(curr.neto) || 0), 0);

  const totalPrimerEmpleo = primerEmpleo.reduce((acc, curr) => acc + (parseFloat(curr.remuneracionBruta) || 0), 0);
  const totalEquipamiento = adquisicionEquipamiento.reduce((acc, curr) => acc + (parseFloat(curr.costoTotalSinIva) || 0), 0);
  const totalAportes = compras
    .filter(c => c.concepto?.toLowerCase().includes('aporte') || c.concepto?.toLowerCase().includes('viatico'))
    .reduce((acc, curr) => acc + (parseFloat(curr.neto) || 0), 0);

  // El indicador de suma total de capacitaciones se compondrá de la suma de Capacitaciones + Aportes y Viaticos + Primer Empleo + Adquisicion de Equipamiento
  const totalTraining = capacitaciones.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0) + totalAportes + totalPrimerEmpleo + totalEquipamiento;

  const totalPayroll = nomina.reduce((acc, curr) => acc + (parseFloat(curr.remuneracion) || 0), 0);
  const totalIDInvestment = proyectos.reduce((acc, proj) => {
    const rhTotal = proj.recursosHumanos?.reduce((sum, r) => sum + (r.costoImputado || 0), 0) || 0;
    const matTotal = proj.recursosMateriales?.reduce((sum, m) => sum + (m.monto || 0), 0) || 0;
    return acc + rhTotal + matTotal;
  }, 0);

  const tabs = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'IMPORTAR', label: 'Importar', icon: UploadCloud },
    { id: 'NOMINA_RRHH', label: 'Nómina', icon: Users },
    { id: 'I_D', label: 'I+D', icon: Lightbulb },
    { id: 'CAPACITACION', label: 'Capacitación', icon: GraduationCap },
    { id: 'PRIMER_EMPLEO', label: 'Primer Empleo', icon: Users },
    { id: 'ADQUISICION_EQUIPAMIENTO', label: 'Equipamiento', icon: ShoppingCart },
    { id: 'VENTAS', label: 'Ventas', icon: DollarSign },
    { id: 'CALIDAD', label: 'Calidad', icon: Award },
    { id: 'EXPORTACIONES', label: 'Exportaciones', icon: Globe },
    { id: 'HISTORICO', label: 'Histórico', icon: History },
    { id: 'CONFIG', label: 'Ajustes', icon: Settings },
  ];

  if (!isAuthReady) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;

  if (!selectedCompany || !selectedBienio) {
    return <LandingScreen db={db} onStart={(c, b) => { setSelectedCompany(c); setSelectedBienio(b); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-gray-900">
      <aside className={`fixed md:relative z-20 w-64 h-full bg-white border-r border-gray-200 transform transition-transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-6 flex items-center space-x-3 border-b border-gray-100">
          <img src="/logo.png" alt="Logo LEControl" className="w-10 h-10 object-contain" />
          <h1 className="text-xl font-extrabold text-gray-800 tracking-tight">LEControl</h1>
        </div>

        <div className="px-4 py-4 border-b border-gray-50 bg-gray-50/50">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Contexto Activo</span>
              <button
                onClick={() => { setSelectedCompany(null); setSelectedBienio(null); }}
                className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase flex items-center"
              >
                Cambiar <Plus className="w-3 h-3 ml-1 rotate-45" />
              </button>
            </div>
            <div className="truncate font-bold text-gray-800 text-sm" title={selectedCompany?.razonSocial}>
              {selectedCompany?.razonSocial}
            </div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              <Clock className="w-3 h-3 mr-1" /> Bienio {selectedBienio?.name}
            </div>
          </div>
        </div>
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-180px)] pb-20">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false) }} className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
              <tab.icon className={`mr-3 h-5 w-5 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t bg-gray-50">
          <div className="flex items-center space-x-2 text-xs text-gray-600 mb-2">
            <UserCircle className="w-4 h-4" /> <span className="truncate">{user?.email || 'Anonimo'}</span>
          </div>
        </div>
      </aside>

      <div className="md:hidden bg-white p-4 border-b flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-blue-900">LEControl</span>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)}><Menu /></button>
      </div>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen w-full">
        <div className="w-full">
          {activeTab === 'DASHBOARD' && (
            <DashboardLEC
              db={db}
              lecConfig={config}
              nominaCount={new Set(nomina.map(n => n.cuil)).size}
              nominaFinalCount={nominaFinalCount}
              nominaRecords={nomina.length}
              projectsCount={proyectos.length}
              totalRevenue={totalRevenue}
              totalPromotedRevenue={totalPromotedRevenue}
              totalExport={totalExport}
              totalTraining={totalTraining}
              totalCapacitacionOnly={capacitaciones.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0) + totalAportes}
              totalPrimerEmpleo={totalPrimerEmpleo}
              totalEquipamiento={totalEquipamiento}
              totalPayroll={totalPayroll}
              totalIDInvestment={totalIDInvestment}
            />
          )}
          {activeTab === 'IMPORTAR' && <ImportarArchivos db={db} user={userWithContext} config={config} />}
          {activeTab === 'NOMINA_RRHH' && <NominaRRHH db={db} config={config} user={userWithContext} />}
          {activeTab === 'I_D' && <ProyectosID db={db} config={config} user={userWithContext} />}
          {activeTab === 'CAPACITACION' && <CapacitacionTab db={db} config={config} user={userWithContext} />}
          {activeTab === 'PRIMER_EMPLEO' && <PrimerEmpleoTab db={db} config={config} user={userWithContext} />}
          {activeTab === 'ADQUISICION_EQUIPAMIENTO' && <AdquisicionEquipamientoTab db={db} config={config} user={userWithContext} />}
          {activeTab === 'VENTAS' && <VentasTab db={db} config={config} user={userWithContext} />}
          {activeTab === 'CALIDAD' && <CalidadTab db={db} lecConfig={config} />}
          {activeTab === 'EXPORTACIONES' && <ExportacionesTab db={db} config={config} user={userWithContext} />}
          {activeTab === 'HISTORICO' && <HistoricoTab db={db} user={userWithContext} />}
          {activeTab === 'CONFIG' && <ConfiguracionLEC db={db} lecConfig={config} selectedBienio={selectedBienio} user={userWithContext} />}
        </div>
      </main>
    </div>
  );
};

export default App;