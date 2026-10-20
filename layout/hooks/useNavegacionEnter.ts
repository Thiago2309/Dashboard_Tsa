'use client';
import { useEffect } from 'react';

// Navegación con Enter en todos los formularios del sistema:
//   - Enter       → pasa al siguiente campo (como Tab)
//   - Shift+Enter → regresa al campo anterior
//   - En el último campo Enter no hace nada: guardar siempre es con click.
//
// Respeta el comportamiento propio de los componentes:
//   - Textarea: Enter sigue siendo salto de línea.
//   - Dropdown/AutoComplete/MultiSelect con la lista abierta: Enter selecciona.
//   - Dropdown cerrado y vacío: Enter lo abre; ya con valor, Enter avanza.
//   - Tablas, paginadores y toolbars (filtros, edición en celda) no se tocan.
// Para excluir un campo o una sección: agregar data-enter-nav="off".

const CAMPOS = 'input, select, textarea';

const ZONAS_EXCLUIDAS = '.p-datatable, .p-paginator, .p-toolbar, .p-chips, [data-enter-nav="off"]';

// Paneles flotantes que PrimeReact monta en <body> (filtro de dropdown, calendario, etc.)
const OVERLAYS = '.p-dropdown-panel, .p-multiselect-panel, .p-autocomplete-panel, .p-datepicker, .p-overlaypanel, .p-column-filter-overlay';

const TIPOS_NO_CAMPO = ['hidden', 'button', 'submit', 'reset', 'file', 'image'];

const esCampoNavegable = (el: Element): el is HTMLElement => {
    const campo = el as HTMLInputElement;
    if (campo.disabled || campo.tabIndex < 0) return false;
    if (campo instanceof HTMLInputElement && TIPOS_NO_CAMPO.includes(campo.type)) return false;
    if (el.closest(ZONAS_EXCLUIDAS) || el.closest(OVERLAYS)) return false;
    // Inputs de solo lectura (totales calculados) se saltan, salvo los de componentes
    // PrimeReact que usan un input readonly para recibir el foco (Dropdown, Calendar...)
    if (campo.readOnly && !el.closest('.p-dropdown, .p-multiselect, .p-calendar')) return false;
    return el.getClientRects().length > 0;
};

// El componente tiene su lista abierta (Dropdown, AutoComplete, MultiSelect)
const tieneListaAbierta = (el: HTMLElement) => {
    if (el.getAttribute('aria-expanded') === 'true') return true;
    const wrapper = el.closest('.p-inputwrapper');
    return !!wrapper?.querySelector('[aria-expanded="true"]');
};

const cerrarCalendarioAbierto = (el: HTMLElement) => {
    if (!el.closest('.p-calendar')) return;
    if (!document.querySelector('.p-datepicker:not(.p-datepicker-inline)')) return;
    // El Calendar se cierra con un click fuera de él
    document.body.click();
};

const useNavegacionEnter = () => {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Enter' || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;

            const actual = event.target as HTMLElement | null;
            if (!actual || !actual.matches?.(CAMPOS)) return;
            if (actual instanceof HTMLTextAreaElement) return;
            if (!esCampoNavegable(actual)) return;
            if (tieneListaAbierta(actual)) return;

            // Dropdown cerrado y sin valor: dejar que Enter lo abra para elegir
            const dropdown = actual.closest('.p-dropdown, .p-multiselect');
            if (dropdown && !dropdown.classList.contains('p-inputwrapper-filled')) return;

            const contenedor = actual.closest('.p-dialog, .p-sidebar, form') || actual.closest('.layout-main') || document.body;
            const campos = Array.from(contenedor.querySelectorAll(CAMPOS)).filter(esCampoNavegable);
            const indice = campos.indexOf(actual);
            if (indice === -1) return;

            // A partir de aquí Enter es nuestro: que no envíe formularios ni abra/cierre componentes
            event.preventDefault();
            event.stopPropagation();

            const destino = campos[indice + (event.shiftKey ? -1 : 1)];
            if (!destino) return; // último campo: no guarda, se queda ahí

            cerrarCalendarioAbierto(actual);
            destino.focus();
            if (destino instanceof HTMLInputElement && !destino.readOnly && ['text', 'number', 'tel', 'email', 'search', 'password', ''].includes(destino.type)) {
                destino.select();
            }
        };

        // Fase de captura en window: corre antes que los handlers de React/PrimeReact
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, []);
};

export default useNavegacionEnter;
