import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sprout, LayoutDashboard, Leaf, CalendarDays, ScanLine, BarChart3,
  Settings, Search, Bell, Plus, Sun, Droplets, Flower2, ChevronRight,
  Menu, X, ArrowUpRight, CircleCheck, LogOut, Camera, Upload, Image as ImageIcon,
  Clock3, Check, Circle, Trash2, UserRound, ShieldCheck, BellRing, Palette,
  Download, LockKeyhole, Save, CalendarCheck, Sparkles, PencilLine,
  AlertCircle, RotateCcw, Eye, CalendarPlus, ChevronLeft,
  MessageCircle, NotebookPen, Scale, Send,
} from "lucide-react";
import "./App.css";
import { useAuth } from "./context/AuthContext";
import { listarCultivos, crearCultivo } from "./services/cultivos";
import { identificarPlanta } from "./services/escanner";
import { supabase } from "./lib/supabase";

const menu = [
  { label: "Mi jardín", icon: LayoutDashboard },
  { label: "Mis cultivos", icon: Sprout },
  { label: "Mis plantas", icon: Leaf },
  { label: "Escáner botánico", icon: ScanLine },
  { label: "Calendario", icon: CalendarDays },
  { label: "Estadísticas", icon: BarChart3 },
  { label: "Comunidad", icon: MessageCircle },
];
const COLORES_CULTIVO = ["#E3EEDF", "#F8E8DC", "#F6E8C9", "#E4EAF5"];
const TIPOS_TAREA = ["Riego", "Fertilización", "Poda", "Trasplante", "Cosecha", "Revisión"];
const tareasIniciales = [];
function leerTareas() {
  try { return JSON.parse(localStorage.getItem("floraviva-tareas") || "[]"); }
  catch { return tareasIniciales; }
}

function presentarCultivo(cultivo, indice = 0) {
  const estados = {
    planificado: { texto: "Planificado", progreso: 0 },
    activo: { texto: "En crecimiento", progreso: 45 },
    finalizado: { texto: "Finalizado", progreso: 100 },
  };
  const estado = estados[cultivo.estado] ?? estados.activo;
  return {
    id: cultivo.id,
    name: cultivo.nombre_comun,
    type: cultivo.nombre_cientifico || cultivo.variedad || "Especie por identificar",
    stage: estado.texto,
    progress: estado.progreso,
    emoji: "🪴",
    color: COLORES_CULTIVO[indice % COLORES_CULTIVO.length],
    water: "Por programar",
    estado: cultivo.estado,
  };
}

function fechaISO(fecha = new Date()) {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function leerPreferencias() {
  try { return JSON.parse(localStorage.getItem("floraviva-preferencias") || "{}"); }
  catch { return {}; }
}

const CONSEJOS_VERDES = [
  "Riega la tierra, no solo las hojas: comprueba primero la humedad con un dedo.",
  "Gira las macetas un cuarto de vuelta cada semana para favorecer un crecimiento uniforme.",
  "Retira las hojas secas con herramientas limpias para reducir refugios de plagas.",
  "Agrupa plantas con necesidades de humedad parecidas para facilitar sus cuidados.",
  "Riega temprano en la mañana cuando sea posible y evita encharcar las raíces.",
  "Antes de fertilizar, revisa la etiqueta y respeta la dosis recomendada.",
  "Una buena maceta necesita agujeros de drenaje para evitar raíces asfixiadas.",
  "Revisa el envés de las hojas: algunas plagas se esconden allí.",
  "Anota cuándo aparece una flor o un fruto; esos datos ayudan a conocer tu planta.",
  "Limpia el polvo de las hojas grandes con un paño suave y húmedo.",
  "Aclimata poco a poco una planta antes de cambiarla a un lugar con sol directo.",
  "Usa compost maduro en cantidades moderadas para mejorar la estructura del sustrato.",
  "Si una planta se marchita, comprueba tanto la falta como el exceso de agua.",
  "Etiqueta las semillas con su nombre y fecha de siembra para no confundir variedades.",
  "Deja espacio entre plantas para que circule el aire y se sequen las hojas.",
  "Lava y desinfecta las tijeras entre plantas si sospechas una enfermedad.",
  "Cosecha los frutos cuando alcancen la madurez propia de su especie y variedad.",
  "Evita cambiar de golpe una planta de sombra a pleno sol: hazlo gradualmente.",
  "Comprueba la parte inferior de la maceta y el drenaje cuando el sustrato tarda en secar.",
  "Registra el tamaño de una planta cada dos semanas para comparar su crecimiento real.",
  "No todas las plantas necesitan agua a diario: ajusta el riego al clima y al sustrato.",
  "Retira las malas hierbas jóvenes antes de que compitan demasiado por agua y nutrientes.",
  "Guarda semillas solo de frutos sanos y deja que se sequen según la especie.",
  "Limpia las herramientas después de usarlas y guárdalas secas.",
  "Observa cambios de color en las hojas antes de aplicar tratamientos; no todos indican plagas.",
  "En días muy calurosos, revisa la humedad de las macetas con más frecuencia.",
  "Un acolchado orgánico puede ayudar a conservar la humedad y moderar la temperatura del suelo.",
  "Evita aplicar productos de control sin identificar primero el problema y leer sus instrucciones.",
  "Registra la cantidad de frutos por cosecha para comparar temporadas y cuidados.",
  "Las plantas recién trasplantadas suelen necesitar unos días de adaptación y vigilancia.",
  "Usa recipientes limpios para semilleros y no reutilices sustrato enfermo.",
  "Siembra especies adecuadas a la luz y al clima disponibles en tu espacio.",
  "Revisa tus plantas una vez por semana con calma: detectar cambios temprano ayuda mucho.",
  "Deja madurar algunos frutos sanos si quieres obtener semillas, cuando la especie lo permita.",
  "Regar lentamente permite que el agua penetre en el sustrato en lugar de escurrirse por los bordes.",
];
function obtenerConsejoDiario() {
  const hoy = fechaISO();
  try {
    const guardado = JSON.parse(localStorage.getItem("floraviva-consejos-diarios") || "{}");
    if (guardado.fecha === hoy && guardado.consejo) return guardado.consejo;
    let vistos = Array.isArray(guardado.vistos) ? guardado.vistos : [];
    let disponibles = CONSEJOS_VERDES.filter((consejo) => !vistos.includes(consejo));
    if (!disponibles.length) { vistos = []; disponibles = [...CONSEJOS_VERDES]; }
    const consejo = disponibles[Math.floor(Math.random() * disponibles.length)];
    localStorage.setItem("floraviva-consejos-diarios", JSON.stringify({ fecha: hoy, consejo, vistos: [...vistos, consejo] }));
    return consejo;
  } catch { return CONSEJOS_VERDES[new Date().getDate() % CONSEJOS_VERDES.length]; }
}

function App() {
  const [active, setActive] = useState("Mi jardín");
  const [search, setSearch] = useState("");
  const [crops, setCrops] = useState([]);
  const [cargandoCultivos, setCargandoCultivos] = useState(true);
  const [guardandoCultivo, setGuardandoCultivo] = useState(false);
  const [errorCultivos, setErrorCultivos] = useState("");
  const [mensajeCultivos, setMensajeCultivos] = useState("");
  const { usuario, cerrarSesion } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState("");
  const [scanName, setScanName] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [scanResults, setScanResults] = useState([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanOrgano, setScanOrgano] = useState("auto");
  const scanInput = useRef(null);
  const scanCameraInput = useRef(null);
  const [tasks, setTasks] = useState(() => leerTareas());
  const [taskForm, setTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("Riego");
  const [taskDate, setTaskDate] = useState(fechaISO());
  const [taskPlant, setTaskPlant] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(fechaISO());
  const [preferences, setPreferences] = useState(() => ({
    emailAlerts: true, careReminders: true, weeklySummary: false, compactView: false,
    theme: "natural", language: "es", units: "metric", ...leerPreferencias(),
  }));
  const [settingsMessage, setSettingsMessage] = useState("");
  const [profileName, setProfileName] = useState(() => {
    try { return localStorage.getItem("floraviva-nombre") || ""; }
    catch { return ""; }
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [observations, setObservations] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [forumPosts, setForumPosts] = useState([]);
  const [trackingError, setTrackingError] = useState("");
  const [trackingMessage, setTrackingMessage] = useState("");
  const [observationCropId, setObservationCropId] = useState("");
  const [observationText, setObservationText] = useState("");
  const [shareObservation, setShareObservation] = useState(false);
  const [harvestCropId, setHarvestCropId] = useState("");
  const [harvestCount, setHarvestCount] = useState("1");
  const [harvestDate, setHarvestDate] = useState(fechaISO());
  const [harvestNotes, setHarvestNotes] = useState("");
  const [forumTitle, setForumTitle] = useState("");
  const [forumCategory, setForumCategory] = useState("Consejos");
  const [forumContent, setForumContent] = useState("");
  const [forumFilter, setForumFilter] = useState("Todas");
  const [dailyTip, setDailyTip] = useState(() => obtenerConsejoDiario());

  useEffect(() => {
    let cancelado = false;
    async function cargarCultivos() {
      setCargandoCultivos(true); setErrorCultivos("");
      try {
        const datos = await listarCultivos();
        if (!cancelado) setCrops(datos.map((cultivo, indice) => presentarCultivo(cultivo, indice)));
      } catch (error) {
        if (!cancelado) setErrorCultivos(error.message || "No se pudieron cargar los cultivos.");
      } finally { if (!cancelado) setCargandoCultivos(false); }
    }
    cargarCultivos();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function cargarSeguimiento() {
      if (!usuario?.id) return;
      const [obs, cosechas, publicaciones] = await Promise.allSettled([
        supabase.from("observaciones_cultivo").select("*").eq("user_id", usuario.id).order("created_at", { ascending: false }),
        supabase.from("produccion_cultivo").select("*").eq("user_id", usuario.id).order("fecha", { ascending: false }),
        supabase.from("foro_publicaciones").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      if (cancelado) return;
      const errores = [];
      if (obs.status === "fulfilled" && !obs.value.error) setObservations(obs.value.data || []);
      else errores.push("observaciones_cultivo");
      if (cosechas.status === "fulfilled" && !cosechas.value.error) setHarvests(cosechas.value.data || []);
      else errores.push("produccion_cultivo");
      if (publicaciones.status === "fulfilled" && !publicaciones.value.error) setForumPosts(publicaciones.value.data || []);
      else errores.push("foro_publicaciones");
      if (errores.length) setTrackingError(`Faltan tablas o permisos de Supabase (${errores.join(", ")}). Ejecuta el archivo supabase/floraviva_seguimiento.sql en el SQL Editor de tu proyecto Supabase.`);
    }
    cargarSeguimiento();
    return () => { cancelado = true; };
  }, [usuario?.id]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setDailyTip(obtenerConsejoDiario()), 60_000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("floraviva-tareas", JSON.stringify(tasks)); } catch { /* almacenamiento opcional */ }
  }, [tasks]);

  useEffect(() => {
    if (!scanFile) { setScanPreview(""); return undefined; }
    const url = URL.createObjectURL(scanFile); setScanPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [scanFile]);

  const visibleCrops = useMemo(() => crops.filter((crop) =>
    `${crop.name} ${crop.type}`.toLowerCase().includes(search.toLowerCase())), [crops, search]);
  const tareasPendientes = tasks.filter((task) => !task.done);
  const tareasHoy = tareasPendientes.filter((task) => task.date === fechaISO());
  const nombreUsuario = profileName.trim() || (usuario?.email ? usuario.email.split("@")[0] : "Jardinero");

  async function addCrop(event) {
    event.preventDefault(); const nombre = newName.trim(); if (!nombre) return;
    setGuardandoCultivo(true); setErrorCultivos(""); setMensajeCultivos("");
    try {
      const creado = await crearCultivo({ nombre_comun: nombre, estado: "activo" });
      setCrops((anteriores) => [presentarCultivo(creado, anteriores.length), ...anteriores]);
      setNewName(""); setShowForm(false); setActive("Mis cultivos");
      setMensajeCultivos(`Cultivo «${creado.nombre_comun}» guardado correctamente.`);
    } catch (error) { setErrorCultivos(error.message || "No se pudo guardar el cultivo."); }
    finally { setGuardandoCultivo(false); }
  }

  function addTask(event) {
    event.preventDefault();
    if (!taskTitle.trim() || !taskDate) return;
    setTasks((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, title: taskTitle.trim(), type: taskType, date: taskDate, plant: taskPlant, done: false }]);
    setTaskTitle(""); setTaskPlant(""); setTaskForm(false); setSelectedDate(taskDate);
  }
  function changePreference(key, value) {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem("floraviva-preferencias", JSON.stringify(next)); } catch { /* almacenamiento opcional */ }
      return next;
    });
    setSettingsMessage("Preferencia guardada en este dispositivo.");
  }
  async function handleLogout() {
    if (logoutLoading) return;
    setLogoutLoading(true); setLogoutError("");
    try {
      await cerrarSesion();
      window.location.replace("/");
    } catch (error) {
      setLogoutError(error?.message || "No se pudo cerrar la sesión. Comprueba tu conexión e inténtalo de nuevo.");
    } finally { setLogoutLoading(false); }
  }

  async function guardarObservacion(event) {
    event.preventDefault();
    if (!observationCropId || !observationText.trim()) return;
    setTrackingError(""); setTrackingMessage("");
    const { data, error } = await supabase.from("observaciones_cultivo").insert({
      user_id: usuario.id, cultivo_id: observationCropId, observacion: observationText.trim(),
    }).select().single();
    if (error) { setTrackingError(`No se pudo guardar la observación: ${error.message}`); return; }
    setObservations((prev) => [data, ...prev]); setObservationText("");
    if (shareObservation) {
      const cultivo = crops.find((crop) => crop.id === observationCropId);
      const nombre = profileName.trim() || usuario?.user_metadata?.nombre || usuario?.email?.split("@")[0] || "Comunidad FloraViva";
      const { data: publicacion, error: errorForo } = await supabase.from("foro_publicaciones").insert({
        user_id: usuario.id, autor_nombre: nombre, titulo: `Observación de ${cultivo?.name || "mi cultivo"}`,
        categoria: "Observaciones", contenido: observationText.trim(),
      }).select().single();
      if (errorForo) {
        setShareObservation(false);
        setTrackingError(`La observación quedó guardada, pero no se pudo compartir en el foro: ${errorForo.message}`);
        setTrackingMessage("Observación guardada en tu cuenta.");
        return;
      }
      setForumPosts((prev) => [publicacion, ...prev]);
    }
    setShareObservation(false);
    setTrackingMessage(shareObservation ? "Observación guardada y compartida con la comunidad." : "Observación guardada en tu cuenta.");
  }

  async function guardarCosecha(event) {
    event.preventDefault();
    const cantidad = Number(harvestCount);
    if (!harvestCropId || !Number.isInteger(cantidad) || cantidad < 0 || !harvestDate) return;
    setTrackingError(""); setTrackingMessage("");
    const { data, error } = await supabase.from("produccion_cultivo").insert({
      user_id: usuario.id, cultivo_id: harvestCropId, cantidad_frutos: cantidad,
      fecha: harvestDate, notas: harvestNotes.trim() || null,
    }).select().single();
    if (error) { setTrackingError(`No se pudo registrar la cosecha: ${error.message}`); return; }
    setHarvests((prev) => [data, ...prev]); setHarvestCount("1"); setHarvestNotes("");
    setTrackingMessage(`Cosecha registrada: ${cantidad} ${cantidad === 1 ? "fruto" : "frutos"}.`);
  }

  async function publicarEnForo(event) {
    event.preventDefault();
    if (!forumTitle.trim() || !forumContent.trim()) return;
    setTrackingError(""); setTrackingMessage("");
    const nombre = profileName.trim() || usuario?.user_metadata?.nombre || usuario?.email?.split("@")[0] || "Comunidad FloraViva";
    const { data, error } = await supabase.from("foro_publicaciones").insert({
      user_id: usuario.id, autor_nombre: nombre, titulo: forumTitle.trim(),
      categoria: forumCategory, contenido: forumContent.trim(),
    }).select().single();
    if (error) { setTrackingError(`No se pudo publicar en el foro: ${error.message}`); return; }
    setForumPosts((prev) => [data, ...prev]); setForumTitle(""); setForumContent("");
    setTrackingMessage("Tu publicación ya está disponible para la comunidad.");
  }

  function handleScan(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setScanStatus("Selecciona un archivo de imagen válido."); return; }
    if (file.size > 10 * 1024 * 1024) { setScanStatus("La imagen supera el límite de 10 MB. Selecciona una imagen más ligera."); return; }
    setScanFile(file); setScanStatus(""); setScanName(""); setScanResults([]);
  }
  function resetScan() { setScanFile(null); setScanName(""); setScanStatus(""); setScanResults([]); if (scanInput.current) scanInput.current.value = ""; if (scanCameraInput.current) scanCameraInput.current.value = ""; }
  async function requestScanAnalysis(event) {
    event.preventDefault();
    if (!scanFile || scanLoading) return;
    setScanLoading(true); setScanStatus(""); setScanResults([]);
    try {
      const resultado = await identificarPlanta(scanFile, scanOrgano);
      setScanResults(resultado.resultados || []);
      if (!resultado.resultados?.length) setScanStatus(resultado.mensaje || "No se encontraron coincidencias. Prueba con otra foto.");
    } catch (error) { setScanStatus(error.message || "No se pudo analizar la imagen."); }
    finally { setScanLoading(false); }
  }

  const pageDescriptions = {
    "Mi jardín": "Un vistazo amable a todo lo que estás haciendo crecer.",
    "Mis cultivos": "Organiza tus cultivos y sigue su evolución.",
    "Mis plantas": "Cada planta tiene sus propios cuidados y su historia.",
    "Escáner botánico": "Identifica especies a partir de una fotografía con ayuda de Pl@ntNet.",
    "Calendario": "Planifica los cuidados y mantén las tareas al día.",
    "Estadísticas": "Consulta el resumen de tu actividad y tu colección.",
    "Comunidad": "Comparte experiencias, observaciones y preguntas con otros cultivadores.",
    "Configuración": "Personaliza tu espacio y controla tus preferencias.",
  };
  const title = active;

  function navTo(label) { setActive(label); setMobileMenu(false); setSearch(""); setMensajeCultivos(""); }

  return (
    <div className={`app-shell theme-${preferences.theme} ${preferences.compactView ? "compact-view" : ""}`}>
      {mobileMenu && <button className="mobile-overlay" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Sprout size={25} /></div>
          <div><h1>FloraViva</h1><span>Tu mundo, más verde</span></div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <div className="menu-caption">TU ESPACIO PERSONAL</div>
        <nav className="navigation" aria-label="Navegación principal">
          {menu.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? "nav-active" : ""}`} onClick={() => navTo(label)}>
            <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
            {label === "Mis cultivos" && <span className="nav-count">{crops.length}</span>}
            {label === "Calendario" && tareasPendientes.length > 0 && <span className="nav-count">{tareasPendientes.length}</span>}
          </button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="garden-tip"><Sun size={22} /><strong>Consejo del día</strong><p>{dailyTip}</p></div>
          <button className={`nav-item ${active === "Configuración" ? "nav-active" : ""}`} onClick={() => navTo("Configuración")}><Settings size={19} /><span>Configuración</span></button>
          <button className="nav-item logout-nav-item" onClick={handleLogout} disabled={logoutLoading}><LogOut size={19} /><span>{logoutLoading ? "Cerrando sesión…" : "Cerrar sesión"}</span></button>
          <div className="profile">
            <div className="avatar">{(usuario?.email || "FV").slice(0, 2).toUpperCase()}</div>
            <div className="profile-info"><strong>{nombreUsuario}</strong><span>{usuario?.email || "Usuario conectado"}</span></div>
            <button className="icon-button" type="button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={handleLogout} disabled={logoutLoading}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu size={23} /></button>
          <div className="breadcrumb"><span>FloraViva</span><ChevronRight size={14} /><strong>{active}</strong></div>
          <div className="top-actions">
            {!["Escáner botánico", "Calendario", "Configuración", "Comunidad"].includes(active) && <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar plantas o cultivos..." aria-label="Buscar plantas o cultivos" /></label>}
            <button className="icon-button notification-button" aria-label="Ver tareas pendientes" title="Tareas pendientes" onClick={() => navTo("Calendario")}><Bell size={19} />{tareasPendientes.length > 0 && <i />}</button>
          </div>
        </header>

        <div className="page-content">
          {logoutError && <div className="inline-alert" role="alert"><AlertCircle size={18} /><p>{logoutError}</p><button className="text-button" onClick={() => setLogoutError("")}>Cerrar</button></div>}
          <section className="welcome-row">
            <div><div className="eyebrow"><Sprout size={15} /> TU JARDÍN PERSONAL</div><h2>{active === "Mi jardín" ? `¡Hola, ${nombreUsuario}!` : title}</h2><p>{pageDescriptions[active]}</p></div>
            {(["Mi jardín", "Mis cultivos"].includes(active)) && <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={19} /> Nuevo cultivo</button>}
            {active === "Calendario" && <button className="primary-button" onClick={() => setTaskForm(true)}><Plus size={19} /> Nueva tarea</button>}
          </section>

          {errorCultivos && <div className="inline-alert" role="alert"><AlertCircle size={18} /><div><strong>No se pudo completar la operación</strong><p>{errorCultivos}</p></div><button className="text-button" type="button" onClick={() => window.location.reload()}>Reintentar</button></div>}
          {mensajeCultivos && <p className="success-note" role="status"><CircleCheck size={16} />{mensajeCultivos}</p>}

          {active === "Mi jardín" && <>
            <section className="hero-banner">
              <div className="hero-copy"><span className="hero-tag">CADA DÍA ES UNA OPORTUNIDAD</span><h3>Tu jardín está<br />lleno de posibilidades.</h3><p>Cuida tus plantas hoy y celebra todo lo que crecerá mañana.</p><button className="hero-button" onClick={() => navTo("Mis cultivos")}>Explorar mis cultivos <ArrowUpRight size={17} /></button></div>
              <div className="hero-art" aria-hidden="true"><div className="sun-disc" /><div className="hero-plant">🪴</div><span className="floating-leaf leaf-one">🌿</span><span className="floating-leaf leaf-two">🍃</span></div>
            </section>
            <section className="stats-grid">
              <StatCard icon={Sprout} color="green" label="Mis cultivos" value={crops.length} foot="Cultivos registrados" />
              <StatCard icon={Flower2} color="orange" label="En crecimiento" value={crops.filter((c) => c.estado === "activo").length} foot="Cultivos activos" />
              <StatCard icon={CalendarCheck} color="blue" label="Tareas pendientes" value={tareasPendientes.length} foot={`${tareasHoy.length} para hoy`} /><StatCard icon={Scale} color="orange" label="Frutos registrados" value={harvests.reduce((sum, item) => sum + Number(item.cantidad_frutos || 0), 0)} foot="Total de tus cosechas" />
            </section>
            <section className="dashboard-lower">
              <div className="dashboard-main-panel"><SectionHeading eyebrow="TU COLECCIÓN" title="Cultivos recientes" description="Un vistazo a lo que estás cultivando." action="Ver todos" onAction={() => navTo("Mis cultivos")} />
                <CropGrid crops={visibleCrops.slice(0, 3)} loading={cargandoCultivos} search={search} onView={() => navTo("Mis plantas")} onAdd={() => setShowForm(true)} /></div>
              <aside className="today-panel"><div className="today-heading"><div className="small-icon"><CalendarDays size={18} /></div><div><strong>Para cuidar hoy</strong><span>{new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</span></div></div>
                {tareasHoy.length ? <div className="task-mini-list">{tareasHoy.map((task) => <TaskRow key={task.id} task={task} onToggle={() => setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))} />)}</div> : <div className="today-empty"><Sun size={24} /><strong>Un día para crecer</strong><p>No tienes tareas programadas para hoy.</p><button className="text-button" onClick={() => { setActive("Calendario"); setTaskForm(true); }}>Planificar cuidado <Plus size={15} /></button></div>}
                <button className="panel-link" onClick={() => navTo("Calendario")}>Abrir calendario <ChevronRight size={16} /></button>
              </aside>
            </section>
          </>}

          {active === "Mis cultivos" && <>
            {showForm && <form className="add-form" onSubmit={addCrop}><div><label htmlFor="crop-name">Nombre del cultivo</label><input id="crop-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ej. Cilantro, mango, lechuga..." required autoFocus /></div><button className="primary-button" type="submit" disabled={guardandoCultivo}><Plus size={17} />{guardandoCultivo ? "Guardando…" : "Guardar cultivo"}</button><button className="cancel-button" type="button" onClick={() => setShowForm(false)}>Cancelar</button></form>}
            <section className="collection-toolbar"><div><strong>{crops.length} {crops.length === 1 ? "cultivo" : "cultivos"}</strong><span>Los registros se sincronizan con tu cuenta.</span></div><button className="soft-button" onClick={() => setShowForm(true)}><Plus size={17} /> Añadir cultivo</button></section>
            <CropGrid crops={visibleCrops} loading={cargandoCultivos} search={search} onView={() => navTo("Mis plantas")} onAdd={() => setShowForm(true)} />
          </>}

          {active === "Mis plantas" && <>
            <div className="care-summary-grid"><div className="care-summary"><div className="stat-icon green"><Leaf size={20} /></div><span>Plantas en tu colección</span><strong>{crops.length}</strong><small>Registradas como cultivos</small></div><div className="care-summary"><div className="stat-icon blue"><Droplets size={20} /></div><span>Riegos por programar</span><strong>{crops.length}</strong><small>Agrega tareas al calendario</small></div><div className="care-summary"><div className="stat-icon orange"><Sun size={20} /></div><span>Cuidados registrados</span><strong>{tasks.filter((t) => t.done).length}</strong><small>Tareas marcadas como realizadas</small></div></div>
            <SectionHeading eyebrow="FICHAS DE PLANTAS" title="Tu colección de plantas" description="Por ahora, las fichas se construyen con tus cultivos registrados." />
            {visibleCrops.length ? <div className="plant-list">{visibleCrops.map((plant) => <article className="plant-row" key={plant.id}><div className="plant-emoji" style={{ background: plant.color }}>{plant.emoji}</div><div className="plant-row-main"><span className="plant-scientific">{plant.type}</span><h3>{plant.name}</h3><div className="plant-meta"><span><Sprout size={14} /> {plant.stage}</span><span><Droplets size={14} /> Riego por programar</span></div></div><div className="plant-progress"><div className="progress-label"><span>Progreso estimado</span><strong>{plant.progress}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${plant.progress}%` }} /></div></div><button className="icon-button" aria-label={`Programar cuidado para ${plant.name}`} onClick={() => { setTaskPlant(plant.name); setActive("Calendario"); setTaskForm(true); }}><CalendarPlus size={17} /></button></article>)}</div> : <EmptyState icon={Leaf} title="Tu colección empieza aquí" text="Registra un cultivo y aparecerá aquí para que puedas organizar sus cuidados." action="Registrar cultivo" onAction={() => { setActive("Mis cultivos"); setShowForm(true); }} />}
          </>}

          {active === "Mis plantas" && <section className="tracking-grid">
            <article className="settings-card tracking-card"><div className="settings-card-title"><div className="settings-card-icon"><NotebookPen size={19} /></div><div><h3>Mis observaciones</h3><p>Anota cambios, floración, plagas, riego o cualquier detalle de tus plantas.</p></div></div>
              <form className="tracking-form" onSubmit={guardarObservacion}><label>Planta o cultivo<select value={observationCropId} onChange={(e) => setObservationCropId(e.target.value)} required><option value="">Selecciona un cultivo</option>{crops.map((crop) => <option value={crop.id} key={crop.id}>{crop.name}</option>)}</select></label><label>Observación<textarea value={observationText} onChange={(e) => setObservationText(e.target.value)} placeholder="Ej. Hoy aparecieron las primeras flores…" rows={3} maxLength={2000} required /></label><label className="share-observation-option"><input type="checkbox" checked={shareObservation} onChange={(e) => setShareObservation(e.target.checked)} /> Compartir también esta observación en el foro comunitario</label><button className="primary-button" type="submit" disabled={!crops.length}><Save size={16} /> Guardar observación</button></form>
              <div className="tracking-records">{observations.length ? observations.map((item) => <article className="tracking-record" key={item.id}><div><strong>{crops.find((crop) => crop.id === item.cultivo_id)?.name || "Mi cultivo"}</strong><time>{item.created_at ? new Date(item.created_at).toLocaleDateString("es-CO", { dateStyle: "medium" }) : "Reciente"}</time></div><p>{item.observacion}</p></article>) : <p className="tracking-empty">Todavía no has guardado observaciones.</p>}</div>
            </article>
            <article className="settings-card tracking-card"><div className="settings-card-title"><div className="settings-card-icon"><Scale size={19} /></div><div><h3>Producción y cosechas</h3><p>Registra la cantidad real de frutos que dio cada planta o cultivo.</p></div></div>
              <form className="tracking-form" onSubmit={guardarCosecha}><label>Planta o cultivo<select value={harvestCropId} onChange={(e) => setHarvestCropId(e.target.value)} required><option value="">Selecciona un cultivo</option>{crops.map((crop) => <option value={crop.id} key={crop.id}>{crop.name}</option>)}</select></label><div className="tracking-form-inline"><label>Cantidad de frutos<input type="number" min="0" step="1" value={harvestCount} onChange={(e) => setHarvestCount(e.target.value)} required /></label><label>Fecha de cosecha<input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} required /></label></div><label>Notas opcionales<textarea value={harvestNotes} onChange={(e) => setHarvestNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Variedad, tamaño, calidad…" /></label><button className="primary-button" type="submit" disabled={!crops.length}><Save size={16} /> Registrar cosecha</button></form>
              <div className="harvest-total"><span>Total de frutos registrados</span><strong>{harvests.reduce((sum, item) => sum + Number(item.cantidad_frutos || 0), 0)}</strong></div><div className="tracking-records">{harvests.slice(0, 8).map((item) => <article className="tracking-record harvest-record" key={item.id}><div><strong>{crops.find((crop) => crop.id === item.cultivo_id)?.name || "Mi cultivo"}</strong><time>{item.fecha}</time></div><p><b>{item.cantidad_frutos}</b> {Number(item.cantidad_frutos) === 1 ? "fruto" : "frutos"}{item.notas ? ` · ${item.notas}` : ""}</p></article>)}{!harvests.length && <p className="tracking-empty">Registra tu primera cosecha para iniciar el historial.</p>}</div>
            </article>
          </section>}

          {active === "Comunidad" && <section className="community-layout">
            <article className="settings-card community-compose"><div className="settings-card-title"><div className="settings-card-icon"><MessageCircle size={19} /></div><div><h3>Comparte con la comunidad</h3><p>Publica una pregunta, una observación o un consejo para otros cultivadores.</p></div></div>
              <form className="tracking-form" onSubmit={publicarEnForo}><label>Título<input value={forumTitle} onChange={(e) => setForumTitle(e.target.value)} placeholder="Ej. ¿Por qué se ponen amarillas las hojas del tomate?" maxLength={140} required /></label><label>Categoría<select value={forumCategory} onChange={(e) => setForumCategory(e.target.value)}><option>Consejos</option><option>Identificación</option><option>Plagas y enfermedades</option><option>Riego y suelo</option><option>Cosechas</option><option>Observaciones</option></select></label><label>Mensaje<textarea value={forumContent} onChange={(e) => setForumContent(e.target.value)} placeholder="Cuenta qué has observado o qué te gustaría consultar…" rows={4} maxLength={5000} required /></label><button className="primary-button" type="submit"><Send size={16} /> Publicar en el foro</button></form>
            </article>
            <section className="community-feed"><div className="community-feed-heading"><div><span className="eyebrow">FORO FLORAVIVA</span><h3>Conversaciones recientes</h3></div><select aria-label="Filtrar publicaciones" value={forumFilter} onChange={(e) => setForumFilter(e.target.value)}><option>Todas</option><option>Consejos</option><option>Identificación</option><option>Plagas y enfermedades</option><option>Riego y suelo</option><option>Cosechas</option><option>Observaciones</option></select></div>
              {forumPosts.filter((post) => forumFilter === "Todas" || post.categoria === forumFilter).length ? forumPosts.filter((post) => forumFilter === "Todas" || post.categoria === forumFilter).map((post) => <article className="community-post" key={post.id}><div className="community-post-meta"><span className="community-avatar">{(post.autor_nombre || "FV").slice(0, 1).toUpperCase()}</span><div><strong>{post.autor_nombre || "Comunidad FloraViva"}</strong><time>{post.created_at ? new Date(post.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "Reciente"}</time></div><span className="community-category">{post.categoria}</span></div><h4>{post.titulo}</h4><p>{post.contenido}</p></article>) : <div className="empty-state"><MessageCircle size={30} /><h4>Aún no hay publicaciones</h4><p>Inicia la conversación con una pregunta o comparte una observación de tu jardín.</p></div>}
            </section>
          </section>}
          {trackingError && <div className="inline-alert tracking-alert" role="alert"><AlertCircle size={18} /><p>{trackingError}</p><button className="text-button" onClick={() => setTrackingError("")}>Cerrar</button></div>}
          {trackingMessage && <p className="success-note" role="status"><CircleCheck size={16} />{trackingMessage}</p>}

          {active === "Escáner botánico" && <section className="scanner-layout">
            <div className="scanner-main-panel"><div className="scanner-intro"><div className="scanner-icon"><ScanLine size={23} /></div><div><h3>Explora una planta</h3><p>Toma una foto con la cámara o elige una imagen de tu dispositivo.</p></div></div>
              <input ref={scanCameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={handleScan} aria-label="Tomar una foto de la planta" />
              <input ref={scanInput} className="visually-hidden" type="file" accept="image/*" onChange={handleScan} aria-label="Elegir una imagen de planta" />
              {!scanPreview ? <div className="scan-dropzone"><div className="scan-camera"><Camera size={29} /></div><strong>Explora una planta</strong><span>En el celular puedes tomar una foto; también puedes elegir una imagen guardada.</span><div className="scan-source-actions"><button type="button" className="primary-button" onClick={() => scanCameraInput.current?.click()}><Camera size={16} /> Tomar foto</button><button type="button" className="soft-button" onClick={() => scanInput.current?.click()}><Upload size={16} /> Elegir imagen</button></div><small>JPG, PNG, WEBP · Máximo 10 MB</small></div> : <div className="scan-preview-wrap"><img src={scanPreview} alt="Vista previa de la planta seleccionada" /><div className="scan-preview-actions"><span><ImageIcon size={16} /> {scanFile?.name}</span><button className="soft-button" onClick={() => scanInput.current?.click()}><PencilLine size={15} /> Cambiar foto</button><button className="icon-button" aria-label="Quitar imagen" onClick={resetScan}><Trash2 size={16} /></button></div></div>}
              {scanPreview && <form className="scan-name-form" onSubmit={requestScanAnalysis}><label htmlFor="scan-organ">Parte de la planta<select id="scan-organ" value={scanOrgano} onChange={(event) => setScanOrgano(event.target.value)}><option value="auto">Automático</option><option value="leaf">Hoja</option><option value="flower">Flor</option><option value="fruit">Fruto</option><option value="bark">Corteza</option><option value="habit">Planta completa</option></select></label><label htmlFor="scan-name">Nota opcional</label><input id="scan-name" value={scanName} onChange={(event) => setScanName(event.target.value)} placeholder="Ej. Hojas amarillas en mi albahaca" /><button className="primary-button" type="submit" disabled={scanLoading}><Sparkles size={17} /> {scanLoading ? "Analizando imagen…" : "Identificar planta"}</button></form>}
              {scanLoading && <div className="scan-loading" role="status"><span className="scan-spinner" />Estamos comparando la imagen con el catálogo botánico de Pl@ntNet. Puede tardar unos segundos.</div>}
              {scanStatus && <div className="inline-alert scanner-alert" role="status"><AlertCircle size={18} /><p>{scanStatus}</p></div>}
              {scanResults.length > 0 && <section className="scan-results" aria-live="polite"><div className="scan-results-heading"><div><span className="eyebrow">RESULTADOS DEL ANÁLISIS</span><h3>Posibles identificaciones</h3></div><span className="scan-provider">Pl@ntNet</span></div>{scanName.trim() && <p className="scan-note">Tu nota: {scanName.trim()}</p>}{scanResults.map((result, index) => <article className="scan-result-card" key={`${result.nombre_cientifico}-${index}`}><div className="scan-result-rank">{index + 1}</div><div className="scan-result-copy"><strong>{result.nombre_comun || result.nombre_cientifico}</strong><em>{result.nombre_cientifico}</em>{result.familia && <span>Familia: {result.familia}</span>}</div><div className="scan-confidence"><strong>{result.confianza}%</strong><span>coincidencia</span><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, result.confianza))}%` }} /></div></div></article>)}<p className="scan-disclaimer">Estos resultados son sugerencias automáticas, no un diagnóstico definitivo. Confirma la especie antes de consumirla o usar tratamientos.</p><button type="button" className="soft-button" onClick={resetScan}><RotateCcw size={15} /> Analizar otra planta</button></section>}
            </div>
            <aside className="scanner-side-panel"><h3>Consejos para una buena foto</h3><ul><li><Sun size={17} /><span>Usa luz natural, sin sombras fuertes.</span></li><li><Eye size={17} /><span>Enfoca hojas, tallo y flores con claridad.</span></li><li><ImageIcon size={17} /><span>Evita filtros y procura que la planta ocupe buena parte de la imagen.</span></li><li><ShieldCheck size={17} /><span>Si sospechas una enfermedad, consulta también a un especialista.</span></li></ul><div className="scanner-status"><span className="status-dot" /><div><strong>Identificación botánica</strong><p>Las imágenes se envían al backend protegido; la clave de Pl@ntNet nunca se expone al navegador.</p></div></div></aside>
          </section>}

          {active === "Calendario" && <>
            {taskForm && <form className="task-form" onSubmit={addTask}><div className="task-form-heading"><div><strong>Nueva tarea de cuidado</strong><span>Programa un recordatorio para tu jardín.</span></div><button type="button" className="icon-button" aria-label="Cerrar formulario" onClick={() => setTaskForm(false)}><X size={17} /></button></div><div className="task-form-fields"><label>Actividad<select value={taskType} onChange={(event) => { setTaskType(event.target.value); if (!taskTitle.trim()) setTaskTitle(event.target.value); }}>{TIPOS_TAREA.map((type) => <option key={type}>{type}</option>)}</select></label><label>Descripción<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Ej. Regar las plantas del balcón" required /></label><label>Fecha<input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} required /></label><label>Planta o cultivo<select value={taskPlant} onChange={(event) => setTaskPlant(event.target.value)}><option value="">Jardín en general</option>{crops.map((crop) => <option key={crop.id} value={crop.name}>{crop.name}</option>)}</select></label></div><div className="task-form-actions"><button className="primary-button" type="submit"><Plus size={16} /> Guardar tarea</button><button className="cancel-button" type="button" onClick={() => setTaskForm(false)}>Cancelar</button></div></form>}
            <div className="calendar-layout"><section className="calendar-panel"><div className="calendar-header"><div><span className="eyebrow">PLANIFICACIÓN</span><h3>{calendarMonth.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}</h3></div><div className="calendar-controls"><button className="icon-button" aria-label="Mes anterior" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><button className="soft-button" onClick={() => { const now = new Date(); setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(fechaISO()); }}>Hoy</button><button className="icon-button" aria-label="Mes siguiente" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div></div>
              <CalendarGrid month={calendarMonth} selectedDate={selectedDate} tasks={tasks} onSelect={setSelectedDate} />
              <div className="calendar-legend"><span><i className="legend-dot watering" /> Riego</span><span><i className="legend-dot feeding" /> Fertilización</span><span><i className="legend-dot other" /> Otras tareas</span></div>
            </section><aside className="selected-day-panel"><div className="selected-day-title"><div className="small-icon"><CalendarDays size={18} /></div><div><strong>Agenda del día</strong><span>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</span></div></div><button className="soft-button full-button" onClick={() => { setTaskDate(selectedDate); setTaskForm(true); }}><Plus size={16} /> Añadir tarea</button>
              {tasks.filter((t) => t.date === selectedDate).length ? <div className="selected-task-list">{tasks.filter((t) => t.date === selectedDate).map((task) => <TaskRow key={task.id} task={task} onToggle={() => setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))} onDelete={() => setTasks((prev) => prev.filter((t) => t.id !== task.id))} />)}</div> : <div className="today-empty"><CalendarCheck size={25} /><strong>Día despejado</strong><p>No hay cuidados anotados para esta fecha.</p></div>}
            </aside></div>
          </>}

          {active === "Estadísticas" && <>
            <section className="stats-overview-grid"><StatCard icon={Sprout} color="green" label="Cultivos registrados" value={crops.length} foot="En tu cuenta de FloraViva" /><StatCard icon={CircleCheck} color="blue" label="Tareas completadas" value={tasks.filter((t) => t.done).length} foot="Marcadas como realizadas" /><StatCard icon={Clock3} color="orange" label="Pendientes" value={tareasPendientes.length} foot="Por atender en tu calendario" /><StatCard icon={Flower2} color="green" label="Cultivos activos" value={crops.filter((c) => c.estado === "activo").length} foot="En etapa de crecimiento" /><StatCard icon={Scale} color="orange" label="Frutos cosechados" value={harvests.reduce((sum, item) => sum + Number(item.cantidad_frutos || 0), 0)} foot="Cantidad registrada" /></section>
            <section className="analytics-grid"><article className="analytics-card"><SectionHeading eyebrow="ESTADO DE LA COLECCIÓN" title="Tus cultivos" description="Distribución según el estado registrado." />{crops.length ? <div className="bar-chart">{[{ label: "Activos", count: crops.filter((c) => c.estado === "activo").length, color: "bar-green" }, { label: "Planificados", count: crops.filter((c) => c.estado === "planificado").length, color: "bar-yellow" }, { label: "Finalizados", count: crops.filter((c) => c.estado === "finalizado").length, color: "bar-blue" }].map((item) => <div className="bar-row" key={item.label}><div><span>{item.label}</span><strong>{item.count}</strong></div><div className="bar-track"><div className={item.color} style={{ width: `${Math.max(item.count ? 8 : 0, (item.count / Math.max(crops.length, 1)) * 100)}%` }} /></div></div>)}</div> : <EmptyState icon={BarChart3} title="Aún no hay datos para mostrar" text="Cuando registres cultivos, aquí verás el resumen de tu colección." action="Añadir primer cultivo" onAction={() => { setActive("Mis cultivos"); setShowForm(true); }} />}</article>
              <article className="analytics-card"><SectionHeading eyebrow="HÁBITOS DE CUIDADO" title="Actividad de cuidado" description="Resumen de las tareas de tu calendario." /><div className="completion-ring-wrap"><div className="completion-ring" style={{ "--completion": `${tasks.length ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100) : 0}%` }}><div><strong>{tasks.length ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100) : 0}%</strong><span>completado</span></div></div><div className="completion-key"><span><i className="legend-dot watering" /> {tasks.filter((t) => t.done).length} completadas</span><span><i className="legend-dot pending" /> {tareasPendientes.length} pendientes</span><small>Se calcula a partir de las tareas que has registrado aquí.</small></div></div></article></section>
            <div className="stats-note"><AlertCircle size={17} /><p>Las estadísticas reflejan los cultivos y tareas disponibles en tu cuenta y en esta sesión. Aún no se recopilan mediciones automáticas de crecimiento, clima ni rendimiento.</p></div>
          </>}

          {active === "Configuración" && <section className="settings-layout">
            <nav className="settings-nav"><span>MI CUENTA</span><a href="#perfil" onClick={(e) => { e.preventDefault(); document.getElementById("perfil")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><UserRound size={16} /> Perfil</a><a href="#preferencias" onClick={(e) => { e.preventDefault(); document.getElementById("preferencias")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Palette size={16} /> Preferencias</a><a href="#notificaciones" onClick={(e) => { e.preventDefault(); document.getElementById("notificaciones")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><BellRing size={16} /> Notificaciones</a><a href="#seguridad" onClick={(e) => { e.preventDefault(); document.getElementById("seguridad")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><ShieldCheck size={16} /> Seguridad</a></nav>
            <div className="settings-content">
              <section className="settings-card" id="perfil"><div className="settings-card-title"><div className="settings-card-icon"><UserRound size={19} /></div><div><h3>Perfil</h3><p>Personaliza cómo aparece tu cuenta en FloraViva.</p></div></div><div className="profile-form"><label>Nombre visible<input value={profileName} onChange={(event) => { setProfileName(event.target.value); setProfileSaved(false); }} placeholder={usuario?.email?.split("@")[0] || "Cómo quieres que te llamemos"} /></label><label>Correo electrónico<input value={usuario?.email || ""} readOnly /></label><button className="primary-button" onClick={() => { try { localStorage.setItem("floraviva-nombre", profileName.trim()); } catch { /* almacenamiento opcional */ } setProfileSaved(true); setSettingsMessage("Nombre visible guardado en este dispositivo."); }}><Save size={16} /> Guardar perfil</button>{profileSaved && <span className="inline-success"><Check size={15} /> Nombre aplicado en tu espacio personal.</span>}</div><p className="settings-hint">El nombre visible se guarda en este dispositivo. Para sincronizarlo entre dispositivos, hay que conectarlo al perfil del backend.</p></section>
              <section className="settings-card" id="preferencias"><div className="settings-card-title"><div className="settings-card-icon"><Palette size={19} /></div><div><h3>Preferencias</h3><p>Ajusta la apariencia y la forma de mostrar la información.</p></div></div><SettingSelect label="Estilo de visualización" value={preferences.theme} options={[["natural", "Verde natural"], ["light", "Claro"], ["contrast", "Alto contraste"]]} onChange={(v) => changePreference("theme", v)} /><SettingSelect label="Idioma" value={preferences.language} options={[["es", "Español"]]} onChange={(v) => changePreference("language", v)} /><SettingSelect label="Unidades de medida" value={preferences.units} options={[["metric", "Métrico (°C, cm)"], ["imperial", "Imperial (°F, in)" ]]} onChange={(v) => changePreference("units", v)} /><SettingToggle label="Vista compacta" description="Reduce espacios entre tarjetas para ver más información." checked={preferences.compactView} onChange={(v) => changePreference("compactView", v)} /></section>
              <section className="settings-card" id="notificaciones"><div className="settings-card-title"><div className="settings-card-icon"><BellRing size={19} /></div><div><h3>Notificaciones</h3><p>Elige qué recordatorios quieres preparar para tu jardín.</p></div></div><SettingToggle label="Avisos por correo" description="Preferencia para futuros avisos enviados a tu correo." checked={preferences.emailAlerts} onChange={(v) => changePreference("emailAlerts", v)} /><SettingToggle label="Recordatorios de cuidados" description="Mostrar tareas y avisos de cuidado en tu panel." checked={preferences.careReminders} onChange={(v) => changePreference("careReminders", v)} /><SettingToggle label="Resumen semanal" description="Preferencia para un resumen semanal de tu actividad." checked={preferences.weeklySummary} onChange={(v) => changePreference("weeklySummary", v)} /><p className="settings-hint">Estos interruptores guardan preferencias en este dispositivo; el envío de correos y notificaciones push aún debe conectarse.</p></section>
              <section className="settings-card" id="seguridad"><div className="settings-card-title"><div className="settings-card-icon"><LockKeyhole size={19} /></div><div><h3>Seguridad y sesión</h3><p>Protege el acceso a tu espacio personal.</p></div></div><div className="security-row"><div><strong>Cuenta autenticada</strong><span>Tu sesión se gestiona mediante el proveedor de autenticación configurado.</span></div><ShieldCheck size={22} className="security-check" /></div><div className="security-row"><div><strong>Cerrar sesión</strong><span>Finaliza tu sesión en este dispositivo.</span></div><button className="soft-button" onClick={handleLogout} disabled={logoutLoading}><LogOut size={16} /> {logoutLoading ? "Cerrando…" : "Cerrar sesión"}</button></div><div className="security-row"><div><strong>Exportar información</strong><span>Descarga un resumen local de tus cultivos y tareas.</span></div><button className="soft-button" onClick={() => { const data = { exportedAt: new Date().toISOString(), crops, tasks, observations, harvests }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "floraviva-mis-datos.json"; link.click(); URL.revokeObjectURL(url); }}><Download size={16} /> Exportar JSON</button></div><p className="settings-hint">El cambio de contraseña y la eliminación de cuenta deben gestionarse desde el proveedor de autenticación y un flujo seguro de backend; no se simulan aquí.</p></section>
              {settingsMessage && <p className="success-note" role="status"><CircleCheck size={16} />{settingsMessage}</p>}
            </div>
          </section>}

          <footer className="page-footer"><span>FloraViva © 2026</span><span>Hecho para quienes cultivan vida <span className="footer-heart">♥</span></span><button onClick={() => { window.location.href = "/"; }}>Volver a la página pública</button></footer>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, foot }) {
  return <article className="stat-card"><div className={`stat-icon ${color}`}><Icon size={21} /></div><span className="stat-label">{label}</span><strong className="stat-number">{value}</strong><span className="stat-foot">{foot}</span></article>;
}
function SectionHeading({ eyebrow, title, description, action, onAction }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3>{description && <p>{description}</p>}</div>{action && <button className="text-button" onClick={onAction}>{action} <ChevronRight size={17} /></button>}</div>;
}
function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return <div className="empty-state"><Icon size={32} /><h4>{title}</h4><p>{text}</p>{action && <button className="text-button" onClick={onAction}>{action} <Plus size={16} /></button>}</div>;
}
function CropGrid({ crops, loading, search, onView, onAdd }) {
  if (loading) return <div className="empty-state"><Leaf size={32} /><h4>Cargando tus cultivos…</h4><p>Consultando los datos de tu cuenta.</p></div>;
  if (!crops.length) return <EmptyState icon={Leaf} title={search ? "No encontramos coincidencias" : "Tu jardín empieza con una semilla"} text={search ? "Prueba con otro nombre." : "Registra tu primer cultivo para comenzar a hacer seguimiento."} action={search ? undefined : "Registrar cultivo"} onAction={onAdd} />;
  return <section className="crop-grid">{crops.map((crop) => <article className="crop-card" key={crop.id}><div className="crop-illustration" style={{ background: crop.color }}><span>{crop.emoji}</span><span className="stage-pill"><CircleCheck size={13} /> {crop.stage}</span></div><div className="crop-body"><span className="crop-scientific">{crop.type}</span><h4>{crop.name}</h4><div className="progress-label"><span>Progreso estimado</span><strong>{crop.progress}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${crop.progress}%` }} /></div><div className="crop-footer"><span><Droplets size={15} /> Riego: {crop.water}</span><button aria-label={`Ver cuidados de ${crop.name}`} onClick={onView}><ChevronRight size={19} /></button></div></div></article>)}</section>;
}
function TaskRow({ task, onToggle, onDelete }) {
  const Icon = task.type === "Riego" ? Droplets : task.type === "Fertilización" ? Sparkles : task.type === "Cosecha" ? Sprout : CalendarCheck;
  return <div className={`task-row ${task.done ? "task-done" : ""}`}><button className="task-check" aria-label={task.done ? "Marcar como pendiente" : "Marcar como completada"} onClick={onToggle}>{task.done ? <Check size={15} /> : <Circle size={16} />}</button><div className="task-type-icon"><Icon size={16} /></div><div className="task-row-copy"><strong>{task.title}</strong><span>{task.type}{task.plant ? ` · ${task.plant}` : " · Jardín general"}</span></div>{onDelete && <button className="task-delete" aria-label="Eliminar tarea" onClick={onDelete}><Trash2 size={15} /></button>}</div>;
}
function CalendarGrid({ month, selectedDate, tasks, onSelect }) {
  const year = month.getFullYear(); const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay(); const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return <div className="calendar-grid"><div className="weekday-row">{weekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{cells.map((day, index) => {
    if (!day) return <div className="calendar-day empty-day" key={`empty-${index}`} />;
    const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayTasks = tasks.filter((task) => task.date === date); const isToday = date === fechaISO();
    return <button key={date} className={`calendar-day ${selectedDate === date ? "day-selected" : ""} ${isToday ? "day-today" : ""}`} onClick={() => onSelect(date)}><span>{day}</span>{dayTasks.length > 0 && <div className="day-dots">{dayTasks.slice(0, 3).map((task) => <i key={task.id} className={task.type === "Riego" ? "watering" : task.type === "Fertilización" ? "feeding" : "other"} />)}</div>}</button>;
  })}</div></div>;
}
function SettingToggle({ label, description, checked, onChange }) {
  return <div className="setting-toggle-row"><div><strong>{label}</strong><span>{description}</span></div><button type="button" role="switch" aria-checked={checked} className={`toggle-switch ${checked ? "toggle-on" : ""}`} onClick={() => onChange(!checked)}><span /></button></div>;
}
function SettingSelect({ label, value, options, onChange }) {
  return <label className="setting-select-row"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>;
}

export default App;
