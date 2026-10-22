import { ArrowRight, CheckCircle2, Leaf, ScanLine, ShieldCheck, Sprout, Sun, Users, Droplets } from "lucide-react";
import "./Inicio.css";
import { useAuth } from "../context/AuthContext";

const funciones = [
  { icon: Sprout, titulo: "Organiza tus cultivos", texto: "Registra tus cultivos y mantén su información importante en un solo lugar." },
  { icon: ScanLine, titulo: "Descubre nuevas plantas", texto: "Prepara tu espacio para identificar especies y aprender sobre el mundo botánico." },
  { icon: Sun, titulo: "Cuida cada etapa", texto: "Sigue el estado de tus cultivos y convierte el cuidado en un hábito sencillo." },
];

export default function Inicio() {
  const { sesion } = useAuth();
  const enlacePrincipal = sesion ? "/app" : "/registro";
  return <main className="inicio-publico">
    <header className="inicio-nav">
      <a className="inicio-logo" href="/" aria-label="FloraViva, inicio"><span><Sprout size={23}/></span>FloraViva</a>
      <nav aria-label="Navegación principal"><a href="#funciones">Funciones</a><a href="#equipo">Nuestro equipo</a></nav>
      <div className="inicio-acciones">{sesion ? <a className="inicio-cta" href="/app">Ir a mi jardín <ArrowRight size={16}/></a> : <><a className="inicio-login" href="/login">Iniciar sesión</a><a className="inicio-cta" href="/registro">Crear cuenta <ArrowRight size={16}/></a></>}</div>
    </header>

    <section className="inicio-hero">
      <div className="inicio-hero-copy">
        <div className="inicio-etiqueta"><span></span> CULTIVA CON INTENCIÓN</div>
        <h1>Haz crecer tu jardín.<br/><em>Haz florecer tus ideas.</em></h1>
        <p>FloraViva te acompaña a organizar tus cultivos, cuidar tus plantas y descubrir más sobre la naturaleza, un día a la vez.</p>
        <div className="inicio-hero-botones"><a className="inicio-cta inicio-cta-grande" href={enlacePrincipal}>{sesion ? "Ir a mi jardín" : "Empieza gratis"} <ArrowRight size={18}/></a><a className="inicio-secundario" href="#funciones">Conoce FloraViva <span>↓</span></a></div>
        <div className="inicio-confianza"><span className="inicio-avatares"><i>Z</i><i>P</i></span><span>Creado con dedicación por <strong>Zamir López y Pedro González</strong></span></div>
      </div>
      <div className="inicio-visual" aria-label="Ilustración botánica de una planta creciendo">
        <div className="inicio-circulo"></div><div className="inicio-hoja hoja-uno"></div><div className="inicio-hoja hoja-dos"></div><div className="inicio-hoja hoja-tres"></div><div className="inicio-hoja hoja-cuatro"></div>
        <div className="inicio-maceta"><div className="inicio-tierra"></div></div>
        <div className="inicio-tarjeta-flotante tarjeta-crecimiento"><span><Leaf size={17}/></span><div><strong>Creciendo día a día</strong><small>Todo empieza con cuidado</small></div><CheckCircle2 size={18}/></div>
        <div className="inicio-tarjeta-flotante tarjeta-naturaleza"><span><Droplets size={18}/></span><div><strong>Un jardín más consciente</strong><small>Pequeños hábitos, grandes cambios</small></div></div>
        <div className="inicio-sello"><span>✳</span><small>CRECE<br/>A TU RITMO</small></div>
      </div>
      <div className="inicio-hero-pie"><span>01 / CUIDAR · APRENDER · CRECER</span><span>Una forma más natural de organizar tu jardín <ArrowRight size={14}/></span></div>
    </section>

    <section className="inicio-beneficios" id="funciones"><div className="inicio-seccion-intro"><span>UN ESPACIO PARA CADA HOJA</span><h2>Todo tu jardín, <em>en armonía.</em></h2><p>Herramientas sencillas para que puedas dedicar más tiempo a lo que crece.</p></div>
      <div className="inicio-funciones">{funciones.map(({icon: Icon, titulo, texto}, i) => <article className="inicio-funcion" key={titulo}><div className="inicio-funcion-icono"><Icon size={22}/></div><span className="inicio-numero">0{i+1}</span><h3>{titulo}</h3><p>{texto}</p></article>)}</div>
    </section>

    <section className="inicio-equipo" id="equipo"><div className="inicio-equipo-icono"><Users size={23}/></div><div><span>DE PERSONAS QUE AMAN CREAR</span><h2>Una idea que crece en equipo.</h2><p>FloraViva es un proyecto de <strong>Zamir López</strong> y <strong>Pedro González</strong>, pensado para acercar la tecnología al cuidado cotidiano de las plantas.</p></div><div className="inicio-equipo-firma"><ShieldCheck size={18}/> Diseñado para cultivar mejor</div></section>
    <footer className="inicio-footer"><a className="inicio-logo" href="/"><span><Sprout size={20}/></span>FloraViva</a><span>Hecho para quienes cultivan vida. © {new Date().getFullYear()}</span><div className="inicio-footer-enlaces">{sesion ? <a href="/app">Ir a mi jardín <ArrowRight size={14}/></a> : <a href="/login">Ya tengo una cuenta <ArrowRight size={14}/></a>}<a href="/admin">Acceso de administrador <ShieldCheck size={14}/></a></div></footer>
  </main>;
}
