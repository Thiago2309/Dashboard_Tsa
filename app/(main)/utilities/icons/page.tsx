'use client';
import { useState, useEffect, useRef } from 'react';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { fetchViajes, fetchProveedores, createGasto, Gasto } from '../../../../Services/BD/gastoService';
import { TabPanel, TabView } from 'primereact/tabview';
import { fetchCombustible, createCombustible, updateCombustible, deleteCombustible, fetchOperadores, Combustible } from '../../../../Services/BD/combustibleService';
import { fetchClientesNotes, createCliente, updateCliente, Cliente } from '../../../../Services/BD/clientesService';
import {createViaje, updateViaje, fetchPreciosOrigenDestino, fetchMateriales, fetchM3, Viaje, checkFolioExists, fetchInvitados } from '../../../../Services/BD/viajeService';
import { getUserRoleIdFromLocalStorage } from '@/Services/BD/userService';
import { RadioButton } from 'primereact/radiobutton';
import { Checkbox } from 'primereact/checkbox';
import { InputNumber } from 'primereact/inputnumber';
import { createMaterial, Material } from '../../../../Services/BD/materialService';
import LogisticaTabla from '../../../../app/(main)/pages/crud/Logistica/LogisticaTabla';


const userRoleId = getUserRoleIdFromLocalStorage();
const isAlmacen = userRoleId === 4;

export default function GestionAreas() {
    if (isAlmacen) {
      return (
        <div>
          {/* Solo muestra el formulario de Gastos para rol 4 */}
          <div className="card crud-demo p-4 mb-4">
            <h2>Gestión de Gastos</h2>
            <FormularioGastos />
          </div>
        </div>
      );
    }
  
    // Muestra todos los formularios para otros roles
    return (
      <div>
        {/* Formulario de Viajes */}
        <div className="card crud-demo p-4 mb-4">
            <div>
                <h2>Pre listado de viajes logísticos por Aprobar</h2>
                <LogisticaTabla />
            </div>
        <br />
        <h2>Gestión de Notas de Viajes</h2>
          <FormularioNotaViaje />
        </div>
  
        {/* Formulario de Gastos */}
        <div className="card crud-demo p-4 mb-4">
          <h2>Gestión de Gastos</h2>
          <FormularioGastos />
        </div>
  
        {/* Formulario de Combustible */}
        <div className="card crud-demo p-4 mb-4">
          <h2>Gestión de Combustible</h2>
          <FormularioCombustible />
        </div>
  
        {/* Formulario de Clientes */}
        <div className="card crud-demo p-4 mb-4">
          <h2>Gestión de Clientes</h2>
          <FormularioCliente />
        </div>

        {/* Formulario de material */}
        <div className="card crud-demo p-4 mb-4">
          <h2>Gestión de Material</h2>
          <FormularioMaterial />
        </div>
      </div>
    );
}

// Componente del Formulario de Nota de Viaje
const FormularioNotaViaje = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [viaje, setViaje] = useState<Viaje>({
        id_cliente: null,
        fecha: '',
        folio_bco: '',
        folio: '',
        id_precio_origen_destino: null,
        id_material: null,
        id_m3: null,
        caphrsviajes: null,
        id_operador: null,
        id_invitado: null,
        en_renta: false,
        horas_renta: null,
        horario: 'D',
        numero_viaje: null
    });
    const [clientes, setClientes] = useState<{ id?: number; empresa: string }[]>([]);
    const [preciosOrigenDestino, setPreciosOrigenDestino] = useState<{ id: number; label: string; precio_unidad: number }[]>([]);
    const [materiales, setMateriales] = useState<{ id: number; nombre: string }[]>([]);
    const [operadores, setOperadores] = useState<{ id: number; nombre: string }[]>([]);
    const [m3, setM3] = useState<{ id: number; nombre: string; metros_cubicos: number }[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const toast = useRef<Toast>(null);
    const [folioError, setFolioError] = useState(false);
    const [invitados, setInvitados] = useState<{ id: number; empresa: string }[]>([]);

    // Cargar datos iniciales (clientes, precios, materiales, m3)
    useEffect(() => {
        fetchClientesNotes().then(setClientes);
        fetchPreciosOrigenDestino().then(setPreciosOrigenDestino);
        fetchMateriales().then(setMateriales);
        fetchM3().then(setM3);
        fetchOperadores().then(setOperadores);
        fetchInvitados().then(setInvitados);
    }, []);

    // Opciones para horario (Día/Noche)        
    const horarioOptions = [
        { label: 'Día', value: 'D' },
        { label: 'Noche', value: 'N' }
    ];

    // Guardar o actualizar un viaje
    const saveViaje = async () => {
        setSubmitted(true);

        // Validar campos requeridos
        if (
        viaje.id_cliente !== null &&
        viaje.fecha &&
        viaje.folio_bco &&
        viaje.folio &&
        viaje.id_precio_origen_destino !== null &&
        viaje.id_material !== null &&
        viaje.id_m3 !== null && 
        viaje.id_operador !== null
        ) {
        // Validar que si está en renta, tenga horas
        if (viaje.en_renta && (!viaje.horas_renta || viaje.horas_renta <= 0)) {
            toast.current?.show({ 
            severity: 'error', 
            summary: 'Error', 
            detail: 'Las horas de renta son requeridas cuando el camión está en renta', 
            life: 3000 
            });
            return;
        }

        try {
            // Obtener el precio_unidad y metros_cubicos
            const precioOrigenDestino = preciosOrigenDestino.find(p => p.id === viaje.id_precio_origen_destino);
            const m3Seleccionado = m3.find(m => m.id === viaje.id_m3);

            if (precioOrigenDestino && m3Seleccionado) {
            const precio_unidad = precioOrigenDestino.precio_unidad;
            const metros_cubicos = m3Seleccionado.metros_cubicos;

            // Calcular caphrsviajes - MODIFICADO PARA RENTA
            let caphrsviajes;
            if (viaje.en_renta && viaje.horas_renta) {
                // Si está en renta: precio_unidad * horas_renta
                caphrsviajes = precio_unidad * metros_cubicos * viaje.horas_renta;
            } else {
                // Si no está en renta: precio_unidad * metros_cubicos (comportamiento original)
                caphrsviajes = precio_unidad * metros_cubicos;
            }

            console.log('precio_unidad:', precio_unidad);
            console.log('metros_cubicos:', metros_cubicos);
            console.log('en_renta:', viaje.en_renta);
            console.log('horas_renta:', viaje.horas_renta);
            console.log('caphrsviajes:', caphrsviajes);

            // Actualizar el estado del viaje con el cálculo
            const viajeActualizado = {
                ...viaje,
                caphrsviajes: caphrsviajes,
            };

            // Guardar o actualizar el viaje
            if (viaje.id) {
                const updatedViaje = await updateViaje(viajeActualizado);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Viaje actualizado', life: 3000 });
            } else {
                const newViaje = await createViaje(viajeActualizado);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Viaje creado', life: 3000 });
            }

            // Reiniciar el formulario
            setViaje({
                id_cliente: null,
                fecha: '',
                folio_bco: '',
                folio: '',
                id_precio_origen_destino: null,
                id_material: null,
                id_m3: null,
                caphrsviajes: null,
                id_operador: null,
                id_invitado: null,
                en_renta: false,
                horas_renta: null,
                horario: 'D',
                numero_viaje: null
            });
            setSubmitted(false);
            } else {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se encontró el precio o los metros cúbicos', life: 3000 });
            }
        } catch (error) {
            console.error('Error saving viaje:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar el viaje', life: 3000 });
        }
        }
    };

    return (
        <div className="card p-4">
            <Toast ref={toast} />
            <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
                <TabPanel header="Datos Generales">
                <div className="p-fluid">
                    <div className="field">
                    <label htmlFor="fecha">Fecha</label><span style={{ color: 'red' }}> *</span>
                    <Calendar
                        id="fecha"
                        value={
                            viaje.fecha
                                ? (() => {
                                    const [year, month, day] = viaje.fecha.split('-').map(Number);
                                    return new Date(year, month - 1, day);
                                })()
                                : null
                        }
                        onChange={(e) =>
                            setViaje({
                                ...viaje,
                                fecha: e.value
                                    ? `${e.value.getFullYear()}-${String(e.value.getMonth() + 1).padStart(2, '0')}-${String(e.value.getDate()).padStart(2, '0')}`
                                    : ''
                            })
                        }
                        dateFormat="yy-mm-dd"
                        showIcon
                        required
                        className={submitted && !viaje.fecha ? 'p-invalid' : ''}
                    />
                    {submitted && !viaje.fecha && <small className="p-invalid">Fecha es requerida.</small>}
                    </div>
                    <div className="field">
                    <label htmlFor="folio">Folio</label><span style={{ color: 'red' }}> *</span>
                    <InputText
                        id="folio"
                        value={viaje.folio}
                        onChange={(e) => {
                            setViaje({ ...viaje, folio: e.target.value });
                            // Limpiar el estado de error si el usuario modifica el folio
                            if (folioError) {
                            setFolioError(false);
                            }
                        }}
                        onBlur={async () => {
                            if (viaje.folio && !viaje.id) { // Solo validar si hay folio
                            const folioExists = await checkFolioExists(viaje.folio);
                            if (folioExists) {
                                setFolioError(true); // Activar estado de error
                                toast.current?.show({ 
                                severity: 'error', // Cambiado a 'error' en lugar de 'warn'
                                summary: 'Error: Folio duplicado', 
                                detail: `El folio "${viaje.folio}" ya existe. Por favor ingresa un folio diferente.`, 
                                life: 5000 
                                });
                            } else {
                                setFolioError(false); // Limpiar error si el folio es válido
                            }
                            }
                        }}
                        required
                        className={submitted && !viaje.folio ? 'p-invalid' : (folioError ? 'p-invalid' : '')}
                        />
                    {submitted && !viaje.folio && <small className="p-invalid">Folio es requerido.</small>}
                    </div>
                    <div className="field">
                    <label htmlFor="folio_bco">Folio Banco</label>
                    <InputText
                        id="folio_bco"
                        value={viaje.folio_bco}
                        onChange={(e) => setViaje({ ...viaje, folio_bco: e.target.value })}
                        required
                        className={submitted && !viaje.folio_bco ? 'p-invalid' : ''}
                    />
                    {/* {submitted && !viaje.folio_bco && <small className="p-invalid">Folio Banco es requerido.</small>} */}
                    </div>
                    <div className="field">
                    <label htmlFor="numero_viaje">No. Viaje</label>
                    <InputNumber
                        id="numero_viaje"
                        value={viaje.numero_viaje}
                        onValueChange={(e) => setViaje({ ...viaje, numero_viaje: e.value })}
                        useGrouping={false}
                        required
                        className={submitted && !viaje.numero_viaje ? 'p-invalid' : ''}
                    />
                    {/* {submitted && !viaje.numero_viaje && <small className="p-invalid">No. Viaje es requerido.</small>} */}
                    </div>
                    <div className="field">
                    <label htmlFor="id_cliente">Cliente</label><span style={{ color: 'red' }}> *</span>
                    <Dropdown
                        id="id_cliente"
                        value={viaje.id_cliente}
                        options={clientes.map(c => ({ label: c.empresa, value: c.id }))}
                        onChange={(e) => setViaje({ ...viaje, id_cliente: e.value })}
                        placeholder="Selecciona un cliente"
                        required
                        filter
                        filterBy="label"
                        className={submitted && !viaje.id_cliente ? 'p-invalid' : ''}
                    />
                    {submitted && !viaje.id_cliente && <small className="p-invalid">Cliente es requerido.</small>}
                    </div>
                    <div className="field">
                        <label htmlFor="id_invitado">Invitado</label>
                        <Dropdown
                            id="id_invitado"
                            value={viaje.id_invitado}
                            options={invitados.map(i => ({ label: i.empresa, value: i.id }))}
                            onChange={(e) => setViaje({ ...viaje, id_invitado: e.value })}
                            placeholder="Selecciona un invitado (opcional)"
                            filter
                            filterBy="label"
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="horario">Horario</label>
                        <Dropdown
                            id="horario"
                            value={viaje.horario || 'D'}
                            options={horarioOptions}
                            onChange={(e) => setViaje({ ...viaje, horario: e.value })}
                            placeholder="Selecciona horario"
                        />
                    </div>
                </div>
                </TabPanel>
                <TabPanel header="Detalles del Viaje">
                <div className="p-fluid">
                    <div className="field">
                    <label htmlFor="id_precio_origen_destino">Origen - Destino</label><span style={{ color: 'red' }}> *</span>
                    <Dropdown
                        id="id_precio_origen_destino"
                        value={viaje.id_precio_origen_destino}
                        options={preciosOrigenDestino.map(p => ({
                        label: `${p.label} - ($${p.precio_unidad?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) ?? '0.00'})`,
                        value: p.id,
                        precio_unidad: p.precio_unidad
                        }))}
                        onChange={(e) => setViaje({ ...viaje, id_precio_origen_destino: e.value })}
                        placeholder="Selecciona un origen-destino"
                        required
                        filter
                        filterBy="label"
                        className={submitted && !viaje.id_precio_origen_destino ? 'p-invalid' : ''}
                        itemTemplate={(option) => (
                        <div>
                            <span>{option.label}</span>
                        </div>
                        )}
                    />
                    {submitted && !viaje.id_precio_origen_destino && <small className="p-invalid">Origen - Destino es requerido.</small>}
                    </div>
                    <div className="field">
                    <label htmlFor="id_material">Material</label><span style={{ color: 'red' }}> *</span>
                    <Dropdown
                        id="id_material"
                        value={viaje.id_material}
                        options={materiales.map(m => ({ label: m.nombre, value: m.id }))}
                        onChange={(e) => setViaje({ ...viaje, id_material: e.value })}
                        placeholder="Selecciona un material"
                        required
                        filter
                        filterBy="label"
                        className={submitted && !viaje.id_material ? 'p-invalid' : ''}
                    />
                    {submitted && !viaje.id_material && <small className="p-invalid">Material es requerido.</small>}
                    </div>
                    <div className="field">
                    <label htmlFor="id_m3">Metros Cúbicos</label><span style={{ color: 'red' }}> *</span>
                    <Dropdown
                        id="id_m3"
                        value={viaje.id_m3}
                        options={m3.map(m => ({ 
                            label: `${m.nombre} - (${m.metros_cubicos}m³)`, 
                            value: m.id 
                        }))}
                        onChange={(e) => setViaje({ ...viaje, id_m3: e.value })}
                        placeholder="Selecciona m³"
                        required
                        filter
                        filterBy="label"
                        className={submitted && !viaje.id_m3 ? 'p-invalid' : ''}
                    />
                    {submitted && !viaje.id_m3 && <small className="p-invalid">Metros Cúbicos es requerido.</small>}
                    </div>
                    <div className="field">
                    <label htmlFor="id_operador">Operador</label><span style={{ color: 'red' }}> *</span>
                    <Dropdown
                        id="id_operador"
                        value={viaje.id_operador}
                        options={operadores.map(o => ({ label: o.nombre, value: o.id }))}
                        onChange={(e) => setViaje({ ...viaje, id_operador: e.value })}
                        placeholder="Selecciona un operador"
                        required
                        filter
                        filterBy="label"
                        className={submitted && !viaje.id_operador ? 'p-invalid' : ''}
                    />
                    {submitted && !viaje.id_operador && <small className="p-invalid">Operador es requerido.</small>}
                    </div>
                    
                    {/* NUEVO: Campos para renta */}
                    <div className="field">
                    <label htmlFor="en_renta" className="block mb-2">
                        <Checkbox
                        id="en_renta"
                        checked={viaje.en_renta}
                        onChange={(e) => setViaje({ 
                            ...viaje, 
                            en_renta: e.checked ?? false,
                            horas_renta: e.checked ? (viaje.horas_renta || 0) : null
                        })}
                        />
                        <span className="ml-2">¿El camión está en renta?</span>
                    </label>
                    </div>

                    {/* Campo para horas de renta - solo visible si está en renta */}
                    {viaje.en_renta && (
                    <div className="field">
                        <label htmlFor="horas_renta">Horas de Renta</label><span style={{ color: 'red' }}> *</span>
                        <InputNumber
                        id="horas_renta"
                        value={viaje.horas_renta ?? 0}
                        onValueChange={(e) => setViaje({ ...viaje, horas_renta: e.value ?? 0 })}
                        mode="decimal"
                        min={0}
                        minFractionDigits={2}
                        maxFractionDigits={2}
                        placeholder="0.00"
                        required={viaje.en_renta}
                        className={submitted && viaje.en_renta && !viaje.horas_renta ? 'p-invalid' : ''}
                        />
                        {submitted && viaje.en_renta && !viaje.horas_renta && (
                        <small className="p-invalid">Las horas de renta son requeridas cuando el camión está en renta.</small>
                        )}
                    </div>
                    )}
                </div>
                </TabPanel>
            </TabView>
            {/* Botón Guardar solo se muestra en la segunda pestaña */}
            {activeIndex === 1 && (
                <div className="flex justify-content-end mt-4">
                    <Button label="Guardar" icon="pi pi-check" className="p-button-info mr-2" onClick={saveViaje} />
                </div>
            )}
        </div>
    );
};

// Componente del Formulario de Gastos
const FormularioGastos = () => {
  const [gasto, setGasto] = useState<Gasto>({
      id_viaje: null,
      fecha: '',
      id_proveedor: null,
      refaccion: '',
      importe: null,
      descripcion: '',
  });
  const [viajes, setViajes] = useState<{ id: number; folio: string }[]>([]);
  const [proveedores, setProveedores] = useState<{ id: number; nombre: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const toast = useRef<Toast>(null);

  // Cargar datos iniciales (viajes y proveedores)
  useEffect(() => {
      fetchViajes().then(setViajes);
      fetchProveedores().then(setProveedores);
  }, []);

  // Guardar un gasto
  const saveGasto = async () => {
      setSubmitted(true);

      if (
          gasto.fecha &&
          gasto.id_proveedor !== null &&
          gasto.refaccion.trim() &&
          gasto.importe !== null
      ) {
          try {
              await createGasto(gasto);
              toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Gasto guardado con Exito!', life: 3000 });
              setGasto({
                  fecha: '',
                  id_proveedor: null,
                  refaccion: '',
                  importe: null,
                  descripcion: '',
              });
              setSubmitted(false);
          } catch (error) {
              toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar el gasto', life: 3000 });
          }
      }
  };

  return (
      <div className="card p-4">
          <Toast ref={toast} />
          <TabView>
              <TabPanel header="Datos de Gastos">
                  <div className="p-fluid">
                      <div className="field">
                          <label htmlFor="fecha">Fecha</label><span style={{ color: 'red' }}> *</span>
                            <Calendar
                                id="fecha"
                                value={
                                    gasto.fecha
                                        ? (() => {
                                            const [year, month, day] = gasto.fecha.split('-').map(Number);
                                            return new Date(year, month - 1, day);
                                        })()
                                        : null
                                }
                                onChange={(e) =>
                                    setGasto({
                                        ...gasto,
                                        fecha: e.value
                                            ? `${e.value.getFullYear()}-${String(e.value.getMonth() + 1).padStart(2, '0')}-${String(e.value.getDate()).padStart(2, '0')}`
                                            : ''
                                    })
                                }
                                dateFormat="yy-mm-dd"
                                showIcon
                                required
                                className={submitted && !gasto.fecha ? 'p-invalid' : ''}
                            />
                          {submitted && !gasto.fecha && <small className="p-invalid">Fecha es requerida.</small>}
                      </div>
                      <div className="field">
                          <label htmlFor="id_viaje">Viaje</label>
                          <Dropdown
                              id="id_viaje"
                              value={gasto.id_viaje}
                              options={viajes.map(v => ({ label: v.folio, value: v.id }))}
                              onChange={(e) => setGasto({ ...gasto, id_viaje: e.value })}
                              placeholder="Selecciona un viaje"
                          />
                      </div>
                      <div className="field">
                          <label htmlFor="id_proveedor">Proveedor</label><span style={{ color: 'red' }}> *</span>
                          <Dropdown
                              id="id_proveedor"
                              value={gasto.id_proveedor}
                              options={proveedores.map(p => ({ label: p.nombre, value: p.id }))}
                              onChange={(e) => setGasto({ ...gasto, id_proveedor: e.value })}
                              placeholder="Selecciona un proveedor"
                              required
                              className={submitted && !gasto.id_proveedor ? 'p-invalid' : ''}
                          />
                          {submitted && !gasto.id_proveedor && <small className="p-invalid">Proveedor es requerido.</small>}
                      </div>
                      <div className="field">
                          <label htmlFor="refaccion">Refacción</label><span style={{ color: 'red' }}> *</span>
                          <InputText
                              id="refaccion"
                              value={gasto.refaccion}
                              onChange={(e) => setGasto({ ...gasto, refaccion: e.target.value })}
                              required
                              className={submitted && !gasto.refaccion ? 'p-invalid' : ''}
                          />
                          {submitted && !gasto.refaccion && <small className="p-invalid">Refacción es requerida.</small>}
                      </div>
                      <div className="field">
                          <label htmlFor="descripcion">Descripcion</label><span style={{ color: 'red' }}> *</span>
                          <InputText
                              id="descripcion"
                              value={gasto.descripcion}
                              onChange={(e) => setGasto({ ...gasto, descripcion: e.target.value })}
                              required
                              className={submitted && !gasto.descripcion ? 'p-invalid' : ''}
                          />
                          {submitted && !gasto.descripcion && <small className="p-invalid">descripcion es requerida.</small>}
                      </div>
                      <div className="field">
                          <label htmlFor="importe">Importe</label><span style={{ color: 'red' }}> *</span>
                          <InputText
                              id="importe"
                              value={gasto.importe?.toString() || ''}
                              onChange={(e) => setGasto({ ...gasto, importe: parseFloat(e.target.value) || null })}
                              required
                              className={submitted && !gasto.importe ? 'p-invalid' : ''}
                          />
                          {submitted && !gasto.importe && <small className="p-invalid">Importe es requerido.</small>}
                      </div>
                  </div>
              </TabPanel>
          </TabView>
          <div className="flex justify-content-end mt-4">
              <Button label="Guardar" icon="pi pi-check" className="p-button-info mr-2" onClick={saveGasto} />
          </div>
      </div>
  );
};

// Componente del Formulario de Combustible
const FormularioCombustible = () => {
  const [combustible, setCombustible] = useState<Combustible>({
      id_viaje: null,
      fecha: '',
      id_operador: null,
      litros: null,
      importe: null,
  });
  const [viajes, setViajes] = useState<{ id: number; folio: string }[]>([]);
  const [operadores, setOperadores] = useState<{ id: number; nombre: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const toast = useRef<Toast>(null);

  // Cargar datos iniciales (viajes y operadores)
  useEffect(() => {
      fetchViajes().then(setViajes);
      fetchOperadores().then(setOperadores);
  }, []);

  // Guardar o actualizar un combustible
  const saveCombustible = async () => {
      setSubmitted(true);

      if (
          combustible.fecha &&
          combustible.id_operador !== null &&
          combustible.litros !== null &&
          combustible.importe !== null
      ) {
          try {
              if (combustible.id) {
                  const updatedCombustible = await updateCombustible(combustible);
                  toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Combustible actualizado', life: 3000 });
              } else {
                  const newCombustible = await createCombustible(combustible);
                  toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Combustible creado', life: 3000 });
              }
              setCombustible({
                  id_viaje: null,
                  fecha: '',
                  id_operador: null,
                  litros: null,
                  importe: null,
              });
              setSubmitted(false);
          } catch (error) {
              toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar el combustible', life: 3000 });
          }
      }
  };

  return (
      <div className="card p-4">
          <Toast ref={toast} />
          <TabView>
              <TabPanel header="Datos de Combustible">
                  <div className="p-fluid">
                      <div className="field">
                          <label htmlFor="fecha">Fecha</label><span style={{ color: 'red' }}> *</span>
                            <Calendar
                                id="fecha"
                                value={
                                    combustible.fecha
                                        ? (() => {
                                            const [year, month, day] = combustible.fecha.split('-').map(Number);
                                            return new Date(year, month - 1, day);
                                        })()
                                        : null
                                }
                                onChange={(e) =>
                                    setCombustible({
                                        ...combustible,
                                        fecha: e.value
                                            ? `${e.value.getFullYear()}-${String(e.value.getMonth() + 1).padStart(2, '0')}-${String(e.value.getDate()).padStart(2, '0')}`
                                            : ''
                                    })
                                }
                                dateFormat="yy-mm-dd"
                                showIcon
                                required
                                className={submitted && !combustible.fecha ? 'p-invalid' : ''}
                            />
                          {submitted && !combustible.fecha && <small className="p-invalid">Fecha es requerida.</small>}
                      </div>
                      <div className="field">
                          <label htmlFor="id_viaje">Viaje</label>
                          <Dropdown
                              id="id_viaje"
                              value={combustible.id_viaje}
                              options={viajes.map(v => ({ label: v.folio, value: v.id }))}
                              onChange={(e) => setCombustible({ ...combustible, id_viaje: e.value })}
                              placeholder="Selecciona un viaje"
                          />
                          {submitted && !combustible.id_viaje && <small className="p-invalid">Viaje es requerido.</small>}
                      </div>
                      <div className="field">
                          <label htmlFor="id_operador">Operador</label><span style={{ color: 'red' }}> *</span>
                          <Dropdown
                              id="id_operador"
                              value={combustible.id_operador}
                              options={operadores.map(o => ({ label: o.nombre, value: o.id }))}
                              onChange={(e) => setCombustible({ ...combustible, id_operador: e.value })}
                              placeholder="Selecciona un operador"
                              required
                              className={submitted && !combustible.id_operador ? 'p-invalid' : ''}
                          />
                          {submitted && !combustible.id_operador && <small className="p-invalid">Operador es requerido.</small>}
                      </div>
                      <div className="field">
                        <label htmlFor="litros">Litros</label><span style={{ color: 'red' }}> *</span>
                        <InputNumber
                            id="litros"
                            value={combustible.litros ?? null}
                            onValueChange={(e) => setCombustible({ ...combustible, litros: e.value ?? null })}
                            mode="decimal"
                            minFractionDigits={2}
                            maxFractionDigits={4} // Permite hasta 4 decimales
                            required
                            className={submitted && !combustible.litros ? 'p-invalid' : ''}
                        />
                            {submitted && !combustible.litros && <small className="p-invalid">Los litros son requeridos.</small>}
                      </div>
                      <div className="field">
                          <label htmlFor="importe">Importe</label><span style={{ color: 'red' }}> *</span>
                          <InputNumber
                                id="importe"
                                value={combustible.importe ?? null}
                                onValueChange={(e) => setCombustible({ ...combustible, importe: e.value ?? null })}
                                mode="currency"
                                currency="MXN"     // o USD, EUR, etc.
                                locale="es-MX"     // formato mexicano: $ 1,234.56
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                required
                                className={submitted && !combustible.importe ? 'p-invalid' : ''}
                            />
                            {submitted && !combustible.importe && <small className="p-invalid">Los importe son requeridos.</small>}
                      </div>
                  </div>
              </TabPanel>
          </TabView>
          <div className="flex justify-content-end mt-4">
              <Button label="Guardar" icon="pi pi-check" className="p-button-info mr-2" onClick={saveCombustible} />
          </div>
      </div>
  );
};

// Componente del Formulario de Clientes
const FormularioCliente = () => {
    const [cliente, setCliente] = useState<Cliente>({
      empresa: '',
      contacto: '',
      telefono: '',
      tipo_cliente: undefined,
      rfc: '',
      direccion: '',
      metodo_pago: undefined,
      uso_cfdi: '',
      regimen_fiscal: '',
      obra: '',
      estatus: 1 // Valor por defecto
    });
    
    const [submitted, setSubmitted] = useState(false);
    const toast = useRef<Toast>(null);
  
    // Opciones para los dropdowns/selects
    const TipoCliente = [
        { label: 'Efectivo', value: 'Efectivo' },
        { label: 'Facturado', value: 'Facturado' }
    ];
  
    const metodoPagoOptions = [
      { label: 'Efectivo', value: 'Efectivo' },
      { label: 'Transferencia', value: 'Transferencia' },
    ];
  
    const usoCFDIOptions = [
      { label: 'G01 - Adquisición de mercancías', value: 'G01' },
      { label: 'G03 - Gastos en general', value: 'G03' },
      { label: 'P01 - Por definir', value: 'P01' }
      // Agrega más opciones según sea necesario
    ];
  
    const regimenFiscalOptions = [
      { label: '601 - General de Ley Personas Morales', value: '601' },
      { label: '603 - Personas Morales con Fines no Lucrativos', value: '603' },
      { label: '605 - Sueldos y Salarios', value: '605' }
      // Agrega más opciones según sea necesario
    ];
  
    // Guardar o actualizar un cliente
    const saveCliente = async () => {
      setSubmitted(true);
  
      // Validar campos obligatorios
      if (cliente.empresa.trim() && cliente.contacto.trim()) {
        try {
          if (cliente.id) {
            const updatedCliente = await updateCliente(cliente);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Cliente actualizado', life: 3000 });
          } else {
            const newCliente = await createCliente(cliente);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Cliente creado', life: 3000 });
          }
          // Resetear formulario después de guardar
          setCliente({
            empresa: '',
            contacto: '',
            telefono: '',
            tipo_cliente: undefined,
            rfc: '',
            direccion: '',
            metodo_pago: undefined,
            uso_cfdi: '',
            regimen_fiscal: '',
            obra: '',
            estatus: 1
          });
          setSubmitted(false);
        } catch (error) {
          toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar el cliente', life: 3000 });
        }
      }
    };

    return (
        <div className="card p-4">
            <Toast ref={toast} />
            <div className="p-fluid">
                <div className="field">
                    <label htmlFor="empresa">Empresa</label><span style={{ color: 'red' }}> *</span>
                    <InputText
                    id="empresa"
                    value={cliente.empresa}
                    onChange={(e) => setCliente({ ...cliente, empresa: e.target.value })}
                    required
                    className={submitted && !cliente.empresa ? 'p-invalid' : ''}
                    />
                    {submitted && !cliente.empresa && <small className="p-invalid">Empresa es requerida.</small>}
                </div>
    
                <div className="field">
                    <label htmlFor="contacto">Contacto</label><span style={{ color: 'red' }}> *</span>
                    <InputText
                    id="contacto"
                    value={cliente.contacto}
                    onChange={(e) => setCliente({ ...cliente, contacto: e.target.value })}
                    required
                    className={submitted && !cliente.contacto ? 'p-invalid' : ''}
                    />
                    {submitted && !cliente.contacto && <small className="p-invalid">Contacto es requerido.</small>}
                </div>
    
                <div className="field">
                    <label htmlFor="telefono">Teléfono</label>
                    <InputText
                    id="telefono"
                    value={cliente.telefono}
                    onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                    />
                </div>

                <div className="field">
                    <label htmlFor="direccion">Dirección</label><span style={{ color: 'red' }}> *</span>
                    <InputText
                    id="direccion"
                    value={cliente.direccion}
                    onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                    />
                </div>
    
            <div className="field">
                <label htmlFor="tipo_cliente">Tipo de Cliente</label><span style={{ color: 'red' }}> *</span>
                <Dropdown
                id="tipo_cliente"
                value={cliente.tipo_cliente}
                options={TipoCliente}
                onChange={(e) => setCliente({ ...cliente, tipo_cliente: e.value })}
                placeholder="Selecciona un tipo"
                />
            </div>
    
            {/* aqui */}
            {cliente.tipo_cliente === 'Facturado' && (
                <>
                    <div className="field">
                        <label htmlFor="rfc">RFC</label><span style={{ color: 'red' }}> *</span>
                        <InputText
                            id="rfc"
                            value={cliente.rfc || ''}
                            maxLength={13} // Solo permite 13 caracteres
                            onChange={(e) => setCliente({ ...cliente, rfc: e.target.value })}
                            className={submitted && cliente.tipo_cliente === 'Facturado' && !cliente.rfc ? 'p-invalid' : ''}
                            placeholder="Solo es permitido 13 caracteres"
                        />
                        {submitted && cliente.tipo_cliente === 'Facturado' && !cliente.rfc && (
                            <small className="p-invalid">RFC es requerido para facturación</small>
                        )}
                    </div>

                    <div className="field">
                        <label htmlFor="uso_cfdi">Uso CFDI</label><span style={{ color: 'red' }}> *</span>
                        <Dropdown
                            id="uso_cfdi"
                            value={cliente.uso_cfdi}
                            options={usoCFDIOptions}
                            onChange={(e) => setCliente({ ...cliente, uso_cfdi: e.value })}
                            placeholder="Seleccione uso CFDI"
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="regimen_fiscal">Régimen Fiscal</label><span style={{ color: 'red' }}> *</span>
                        <Dropdown
                            id="regimen_fiscal"
                            value={cliente.regimen_fiscal}
                            options={regimenFiscalOptions}
                            onChange={(e) => setCliente({ ...cliente, regimen_fiscal: e.value })}
                            placeholder="Seleccione uso de Regimen Fiscal"
                        />
                    </div>
                </>
            )}

            <div className="field">
                <label htmlFor="metodo_pago">Método de Pago</label><span style={{ color: 'red' }}> *</span>
                <Dropdown
                id="metodo_pago"
                value={cliente.metodo_pago}
                options={metodoPagoOptions}
                onChange={(e) => setCliente({ ...cliente, metodo_pago: e.value })}
                placeholder="Selecciona un método"
                />
            </div>
    
            <div className="field">
                <label htmlFor="obra">Obra</label><span style={{ color: 'red' }}> *</span>
                <InputText
                id="obra"
                value={cliente.obra}
                onChange={(e) => setCliente({ ...cliente, obra: e.target.value })}
                />
            </div>
    
            <div className="field">
                <label htmlFor="estatus">Estatus</label><span style={{ color: 'red' }}> *</span>
                <div className="flex align-items-center">
                    <div className="flex align-items-center mr-3">
                        <RadioButton
                            inputId="estatus_activo"
                            name="estatus"
                            value={1}
                            onChange={(e) => setCliente({ ...cliente, estatus: 1 })}
                            checked={cliente.estatus === 1}
                        />
                        <label htmlFor="estatus_activo" className="ml-2">Activo</label>
                    </div>
                    {/* <div className="flex align-items-center">
                        <RadioButton
                            inputId="estatus_inactivo"
                            name="estatus"
                            value={0}
                            onChange={(e) => setCliente({ ...cliente, estatus: 0 })}
                            checked={cliente.estatus === 0}
                        />
                        <label htmlFor="estatus_inactivo" className="ml-2">Inactivo</label>
                    </div> */}
                </div>
            </div>
            </div>
    
            <div className="flex justify-content-end mt-4">
            <Button label="Guardar" icon="pi pi-check" className="p-button-info mr-2" onClick={saveCliente} />
            </div>
        </div>
    );
};

// Componente principal
const FormularioMaterial = () => {
    const [material, setMaterial] = useState<Omit<Material, 'id' | 'created_at'>>({
        nombre: '',
        descripcion: '',
    });
    const [submitted, setSubmitted] = useState(false);
    const [materiales, setMateriales] = useState<Material[]>([]);
    const toast = useRef<Toast>(null);

    // Cargar lista de materiales existentes (solo informativo)
    useEffect(() => {
        const loadMateriales = async () => {
            try {
                const data = await fetchMateriales();
                setMateriales(data);
            } catch {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar materiales', life: 3000 });
            }
        };
        loadMateriales();
    }, []);

    // Guardar nuevo material
    const saveMaterial = async () => {
        setSubmitted(true);

        if (!material.nombre.trim()) {
            toast.current?.show({ severity: 'warn', summary: 'Atención', detail: 'El nombre es obligatorio', life: 3000 });
            return;
        }

        try {
            await createMaterial(material);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Material guardado con éxito', life: 3000 });

            setMaterial({ nombre: '', descripcion: '' });
            setSubmitted(false);

            const updated = await fetchMateriales();
            setMateriales(updated);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar el material', life: 3000 });
        }
    };

    return (
        <div className="card p-4">
            <Toast ref={toast} />

            <TabView>
                <TabPanel header="Registro de Materiales">
                    <div className="p-fluid">
                        {/* Nombre del material */}
                        <div className="field">
                            <label htmlFor="nombre">Nombre del Material</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="nombre"
                                value={material.nombre}
                                onChange={(e) => setMaterial({ ...material, nombre: e.target.value })}
                                required
                                className={submitted && !material.nombre ? 'p-invalid' : ''}
                            />
                            {submitted && !material.nombre && <small className="p-error">El nombre es requerido.</small>}
                        </div>

                        {/* Descripción */}
                        <div className="field">
                            <label htmlFor="descripcion">Descripción</label>
                            <InputText
                                id="descripcion"
                                value={material.descripcion || ''}
                                onChange={(e) => setMaterial({ ...material, descripcion: e.target.value })}
                                placeholder="Descripción opcional"
                            />
                        </div>
                    </div>
                </TabPanel>
            </TabView>

            <div className="flex justify-content-end mt-4">
                <Button label="Guardar" icon="pi pi-check" className="p-button-info mr-2" onClick={saveMaterial} />
            </div>

            {/* Lista simple de materiales */}
           <div className="mt-5">
                <h5>Materiales Registrados</h5>
                <div
                    className="grid gap-3 mt-3"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {materiales.map((mat) => (
                        <div
                            key={mat.id}
                            className="p-3 border-round shadow-1 surface-card text-center"
                            style={{
                                border: '1px solid #ddd',
                                borderRadius: '10px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            }}
                        >
                            <b>{mat.nombre}</b>
                            {mat.descripcion && (
                                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#555' }}>
                                    {mat.descripcion}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};