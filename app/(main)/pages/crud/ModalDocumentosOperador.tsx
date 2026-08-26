'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { FileUpload, FileUploadSelectEvent } from 'primereact/fileupload';
import { Toast } from 'primereact/toast';
import {
    fetchDocumentosByOperador,
    subirDocumentoOperador,
    eliminarDocumentoOperador,
    OperadorDocumento
} from '../../../../Services/BD/operadorDocumentoService';
import { Operador } from '../../../../Services/BD/operadoresService';

interface ModalDocumentosOperadorProps {
    visible: boolean;
    onHide: () => void;
    operador: Operador | null;
}

export const ModalDocumentosOperador: React.FC<ModalDocumentosOperadorProps> = ({ visible, onHide, operador }) => {
    const [documentos, setDocumentos] = useState<OperadorDocumento[]>([]);
    const [loading, setLoading] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [nombreDocumento, setNombreDocumento] = useState('');
    const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
    const [visorDialog, setVisorDialog] = useState(false);
    const [documentoVisor, setDocumentoVisor] = useState<OperadorDocumento | null>(null);
    const [documentoAEliminar, setDocumentoAEliminar] = useState<OperadorDocumento | null>(null);
    const fileUploadRef = useRef<FileUpload>(null);
    const toast = useRef<Toast>(null);

    const cargarDocumentos = useCallback(async () => {
        if (!operador?.id) return;
        setLoading(true);
        try {
            const data = await fetchDocumentosByOperador(operador.id);
            setDocumentos(data);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los documentos', life: 3000 });
        } finally {
            setLoading(false);
        }
    }, [operador?.id]);

    useEffect(() => {
        if (visible && operador?.id) {
            cargarDocumentos();
            setNombreDocumento('');
            setArchivoSeleccionado(null);
        }
    }, [visible, operador?.id, cargarDocumentos]);

    const onSelectArchivo = (e: FileUploadSelectEvent) => {
        const file = e.files?.[0];
        if (file) setArchivoSeleccionado(file);
    };

    const subirArchivo = async () => {
        if (!operador?.id || !archivoSeleccionado) return;

        if (archivoSeleccionado.type !== 'application/pdf') {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Solo se permiten archivos PDF', life: 3000 });
            return;
        }

        setSubiendo(true);
        try {
            const nuevo = await subirDocumentoOperador(operador.id, archivoSeleccionado, nombreDocumento);
            setDocumentos(prev => [nuevo, ...prev]);
            setNombreDocumento('');
            setArchivoSeleccionado(null);
            fileUploadRef.current?.clear();
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Documento cargado correctamente', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el documento', life: 3000 });
        } finally {
            setSubiendo(false);
        }
    };

    const abrirVisor = (documento: OperadorDocumento) => {
        setDocumentoVisor(documento);
        setVisorDialog(true);
    };

    const confirmarEliminar = (documento: OperadorDocumento) => {
        setDocumentoAEliminar(documento);
    };

    const eliminarConfirmado = async () => {
        if (!documentoAEliminar) return;
        try {
            await eliminarDocumentoOperador(documentoAEliminar);
            setDocumentos(prev => prev.filter(d => d.id !== documentoAEliminar.id));
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Documento eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el documento', life: 3000 });
        } finally {
            setDocumentoAEliminar(null);
        }
    };

    const fechaBodyTemplate = (rowData: OperadorDocumento) => {
        return rowData.fecha_carga ? new Date(rowData.fecha_carga).toLocaleString('es-MX') : '-';
    };

    const tamanioBodyTemplate = (rowData: OperadorDocumento) => {
        return rowData.tamanio_kb ? `${(rowData.tamanio_kb / 1024).toFixed(2)} MB` : '-';
    };

    const accionesBodyTemplate = (rowData: OperadorDocumento) => {
        return (
            <div className="flex gap-2">
                <Button
                    icon="pi pi-file-pdf"
                    rounded
                    text
                    severity="info"
                    tooltip="Ver PDF"
                    onClick={() => abrirVisor(rowData)}
                />
                <Button
                    icon="pi pi-trash"
                    rounded
                    text
                    severity="danger"
                    tooltip="Eliminar"
                    onClick={() => confirmarEliminar(rowData)}
                />
            </div>
        );
    };

    if (!operador) return null;

    return (
        <>
            <Dialog
                header={`Documentos de ${operador.nombre}`}
                visible={visible}
                style={{ width: '95vw', maxWidth: '750px' }}
                onHide={onHide}
                modal
            >
                <Toast ref={toast} />

                <div className="flex flex-column md:flex-row gap-2 align-items-start md:align-items-end mb-4 p-3 border-1 border-round surface-border">
                    <div className="field flex-1 w-full m-0">
                        <label htmlFor="nombre_documento">Nombre del documento</label>
                        <InputText
                            id="nombre_documento"
                            value={nombreDocumento}
                            onChange={(e) => setNombreDocumento(e.target.value)}
                            placeholder="Ej. INE, CURP, Contrato..."
                        />
                    </div>
                    <div className="field flex-1 w-full m-0">
                        <label>Archivo PDF</label>
                        <FileUpload
                            ref={fileUploadRef}
                            mode="basic"
                            name="documento"
                            accept="application/pdf"
                            maxFileSize={10 * 1024 * 1024}
                            chooseLabel="Elegir PDF"
                            auto={false}
                            onSelect={onSelectArchivo}
                            onClear={() => setArchivoSeleccionado(null)}
                        />
                    </div>
                    <Button
                        label="Subir"
                        icon="pi pi-upload"
                        onClick={subirArchivo}
                        loading={subiendo}
                        disabled={!archivoSeleccionado}
                    />
                </div>

                <DataTable value={documentos} loading={loading} size="small" emptyMessage="Este empleado no tiene documentos cargados">
                    <Column field="nombre_documento" header="Documento" />
                    <Column field="nombre_archivo" header="Archivo" />
                    <Column header="Tamaño" body={tamanioBodyTemplate} style={{ width: '110px' }} />
                    <Column header="Fecha de carga" body={fechaBodyTemplate} style={{ width: '180px' }} />
                    <Column header="Acciones" body={accionesBodyTemplate} style={{ width: '110px' }} />
                </DataTable>
            </Dialog>

            <Dialog
                header={documentoVisor?.nombre_documento || 'Documento'}
                visible={visorDialog}
                style={{ width: '90vw', maxWidth: '900px', height: '90vh' }}
                onHide={() => setVisorDialog(false)}
                modal
                maximizable
                contentStyle={{ height: '100%', padding: 0 }}
            >
                {documentoVisor && (
                    <iframe
                        src={documentoVisor.url}
                        title={documentoVisor.nombre_documento}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                )}
            </Dialog>

            <Dialog
                header="Confirmar"
                visible={!!documentoAEliminar}
                style={{ width: '450px' }}
                onHide={() => setDocumentoAEliminar(null)}
                modal
                footer={
                    <>
                        <Button label="No" icon="pi pi-times" text onClick={() => setDocumentoAEliminar(null)} />
                        <Button label="Sí" icon="pi pi-check" text onClick={eliminarConfirmado} />
                    </>
                }
            >
                <div className="flex align-items-center justify-content-center">
                    <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                    <span>
                        ¿Eliminar el documento <b>{documentoAEliminar?.nombre_documento}</b>?
                    </span>
                </div>
            </Dialog>
        </>
    );
};
