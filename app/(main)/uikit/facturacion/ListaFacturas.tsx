"use client";

import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { getFacturas, descargarFactura, cancelarFactura } from '../../../../Services/BD/facturacion/fiscalApiService';

const ListaFacturas = () => {
    // const [facturas, setFacturas] = useState([]);
    // const [loading, setLoading] = useState(false);
    // const [selectedFactura, setSelectedFactura] = useState(null);
    // const [showDetalleDialog, setShowDetalleDialog] = useState(false);
    // const toast = useRef<Toast>(null);

    // useEffect(() => {
    //     cargarFacturas();
    // }, []);

    // const cargarFacturas = async () => {
    //     setLoading(true);
    //     try {
    //         const data = await getFacturas();
    //         setFacturas(data);
    //     } catch (error: any) {
    //         toast.current?.show({
    //             severity: 'error',
    //             summary: 'Error',
    //             detail: error.message,
    //             life: 3000
    //         });
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // const statusBodyTemplate = (rowData: any) => {
    //     const statusMap = {
    //         'PENDIENTE': { severity: 'warning', label: 'Pendiente' },
    //         'TIMBRADA': { severity: 'success', label: 'Timbrada' },
    //         'CANCELADA': { severity: 'danger', label: 'Cancelada' },
    //         'ERROR': { severity: 'danger', label: 'Error' }
    //     };
    //     const status = statusMap[rowData.status] || { severity: 'info', label: rowData.status };
    //     return <Tag severity={status.severity as any} value={status.label} />;
    // };

    // const fechaBodyTemplate = (rowData: any) => {
    //     return new Date(rowData.fecha_emision).toLocaleString('es-MX');
    // };

    // const totalBodyTemplate = (rowData: any) => {
    //     return `$${rowData.total.toFixed(2)}`;
    // };

    // const actionBodyTemplate = (rowData: any) => {
    //     return (
    //         <div className="flex gap-2">
    //             <Button
    //                 icon="pi pi-eye"
    //                 rounded
    //                 severity="info"
    //                 tooltip="Ver detalles"
    //                 onClick={() => verDetalles(rowData)}
    //             />
    //             {rowData.status === 'TIMBRADA' && (
    //                 <>
    //                     <Button
    //                         icon="pi pi-file-pdf"
    //                         rounded
    //                         severity="danger"
    //                         tooltip="Descargar PDF"
    //                         onClick={() => descargar(rowData.id, 'pdf')}
    //                     />
    //                     <Button
    //                         icon="pi pi-file"
    //                         rounded
    //                         severity="secondary"
    //                         tooltip="Descargar XML"
    //                         onClick={() => descargar(rowData.id, 'xml')}
    //                     />
    //                     <Button
    //                         icon="pi pi-times"
    //                         rounded
    //                         severity="danger"
    //                         tooltip="Cancelar factura"
    //                         onClick={() => cancelar(rowData)}
    //                     />
    //                 </>
    //             )}
    //         </div>
    //     );
    // };

    // const verDetalles = (factura: any) => {
    //     setSelectedFactura(factura);
    //     setShowDetalleDialog(true);
    // };

    // const descargar = async (id: number, tipo: 'xml' | 'pdf') => {
    //     try {
    //         await descargarFactura(id, tipo);
    //         toast.current?.show({
    //             severity: 'success',
    //             summary: 'Descarga iniciada',
    //             detail: `Descargando ${tipo.toUpperCase()}`,
    //             life: 2000
    //         });
    //     } catch (error: any) {
    //         toast.current?.show({
    //             severity: 'error',
    //             summary: 'Error',
    //             detail: error.message,
    //             life: 3000
    //         });
    //     }
    // };

    // const cancelar = async (factura: any) => {
    //     if (confirm(`¿Estás seguro de cancelar la factura ${factura.uuid}?`)) {
    //         try {
    //             const result = await cancelarFactura(factura.uuid);
    //             if (result.success) {
    //                 toast.current?.show({
    //                     severity: 'success',
    //                     summary: 'Factura cancelada',
    //                     detail: `UUID: ${result.uuid}`,
    //                     life: 3000
    //                 });
    //                 cargarFacturas();
    //             } else {
    //                 toast.current?.show({
    //                     severity: 'error',
    //                     summary: 'Error al cancelar',
    //                     detail: result.error,
    //                     life: 3000
    //                 });
    //             }
    //         } catch (error: any) {
    //             toast.current?.show({
    //                 severity: 'error',
    //                 summary: 'Error',
    //                 detail: error.message,
    //                 life: 3000
    //             });
    //         }
    //     }
    // };

    // return (
    //     <div>
    //         <Toast ref={toast} />
            
    //         <div className="flex justify-content-between align-items-center mb-3">
    //             <h3>Facturas Emitidas</h3>
    //             <Button
    //                 label="Actualizar"
    //                 icon="pi pi-refresh"
    //                 onClick={cargarFacturas}
    //                 loading={loading}
    //             />
    //         </div>

    //         <DataTable
    //             value={facturas}
    //             loading={loading}
    //             paginator
    //             rows={10}
    //             rowsPerPageOptions={[5, 10, 25]}
    //             emptyMessage="No hay facturas registradas"
    //             responsiveLayout="scroll"
    //         >
    //             <Column field="serie" header="Serie" style={{ width: '80px' }} />
    //             <Column field="folio" header="Folio" style={{ width: '80px' }} />
    //             <Column field="uuid" header="UUID" style={{ width: '200px' }} />
    //             <Column 
    //                 field="clientes" 
    //                 header="Cliente" 
    //                 body={(rowData) => rowData.clientes?.empresa || 'N/A'}
    //                 style={{ minWidth: '200px' }}
    //             />
    //             <Column 
    //                 field="fecha_emision" 
    //                 header="Fecha" 
    //                 body={fechaBodyTemplate} 
    //                 style={{ width: '180px' }} 
    //             />
    //             <Column 
    //                 field="total" 
    //                 header="Total" 
    //                 body={totalBodyTemplate} 
    //                 style={{ width: '120px' }} 
    //             />
    //             <Column 
    //                 field="status" 
    //                 header="Status" 
    //                 body={statusBodyTemplate} 
    //                 style={{ width: '120px' }} 
    //             />
    //             <Column 
    //                 header="Acciones" 
    //                 body={actionBodyTemplate} 
    //                 style={{ width: '280px' }} 
    //                 exportable={false}
    //             />
    //         </DataTable>

    //         {/* Dialog de detalles */}
    //         <Dialog
    //             visible={showDetalleDialog}
    //             header="Detalles de Factura"
    //             modal
    //             style={{ width: '600px' }}
    //             onHide={() => setShowDetalleDialog(false)}
    //         >
    //             {selectedFactura && (
    //                 <div className="flex flex-column gap-2">
    //                     <div><strong>UUID:</strong> {selectedFactura.uuid}</div>
    //                     <div><strong>Serie:</strong> {selectedFactura.serie} - <strong>Folio:</strong> {selectedFactura.folio}</div>
    //                     <div><strong>Cliente:</strong> {selectedFactura.clientes?.empresa}</div>
    //                     <div><strong>RFC:</strong> {selectedFactura.clientes?.rfc}</div>
    //                     <div><strong>Subtotal:</strong> ${selectedFactura.subtotal.toFixed(2)}</div>
    //                     <div><strong>IVA:</strong> ${selectedFactura.iva.toFixed(2)}</div>
    //                     <div><strong>Total:</strong> ${selectedFactura.total.toFixed(2)}</div>
    //                     <div><strong>Fecha:</strong> {new Date(selectedFactura.fecha_emision).toLocaleString('es-MX')}</div>
    //                     <div><strong>Status:</strong> {selectedFactura.status}</div>
    //                     <div><strong>Método de pago:</strong> {selectedFactura.metodo_pago}</div>
    //                     <div><strong>Forma de pago:</strong> {selectedFactura.forma_pago}</div>
    //                     <div><strong>Uso CFDI:</strong> {selectedFactura.uso_cfdi}</div>
                        
    //                     <hr />
    //                     <h4>Conceptos</h4>
    //                     <DataTable value={selectedFactura.facturas_detalles} size="small">
    //                         <Column field="descripcion" header="Descripción" />
    //                         <Column field="cantidad" header="Cant." style={{ width: '80px' }} />
    //                         <Column field="unidad" header="Unidad" style={{ width: '80px' }} />
    //                         <Column 
    //                             field="precio_unitario" 
    //                             header="Precio" 
    //                             style={{ width: '100px' }}
    //                             body={(rowData) => `$${rowData.precio_unitario.toFixed(2)}`}
    //                         />
    //                         <Column 
    //                             header="Importe" 
    //                             style={{ width: '100px' }}
    //                             body={(rowData) => `$${rowData.importe.toFixed(2)}`}
    //                         />
    //                     </DataTable>
    //                 </div>
    //             )}
    //         </Dialog>
    //     </div>
    // );
};

export default ListaFacturas;