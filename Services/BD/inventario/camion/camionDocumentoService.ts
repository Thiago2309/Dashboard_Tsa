// Services/BD/inventario/camion/camionDocumentoService.ts
import { supabase } from '../../../superbase.service';

const BUCKET = 'documentos-camiones';

export interface CamionDocumento {
    id?: number;
    camion_id: number;
    nombre_documento: string;
    nombre_archivo: string;
    storage_path: string;
    url: string;
    tamanio_kb?: number;
    fecha_carga?: string;
}

export const fetchDocumentosByCamion = async (camionId: number): Promise<CamionDocumento[]> => {
    const { data, error } = await supabase
        .from('camion_documento')
        .select('*')
        .eq('camion_id', camionId)
        .order('fecha_carga', { ascending: false });

    if (error) {
        console.error('Error fetching documentos del camión:', error);
        throw error;
    }

    return data || [];
};

export const subirDocumentoCamion = async (
    camionId: number,
    file: File,
    nombreDocumento: string
): Promise<CamionDocumento> => {
    const nombreSanitizado = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${camionId}/${Date.now()}_${nombreSanitizado}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: 'application/pdf' });

    if (uploadError) {
        console.error('Error subiendo documento a storage:', uploadError);
        throw uploadError;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { data, error } = await supabase
        .from('camion_documento')
        .insert([{
            camion_id: camionId,
            nombre_documento: nombreDocumento.trim() || 'Documento',
            nombre_archivo: file.name,
            storage_path: storagePath,
            url: urlData.publicUrl,
            tamanio_kb: Math.round(file.size / 1024)
        }])
        .select()
        .single();

    if (error) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        console.error('Error registrando documento del camión:', error);
        throw error;
    }

    return data;
};

export const eliminarDocumentoCamion = async (documento: CamionDocumento): Promise<void> => {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([documento.storage_path]);
    if (storageError) {
        console.error('Error eliminando archivo del storage:', storageError);
    }

    const { error } = await supabase
        .from('camion_documento')
        .delete()
        .eq('id', documento.id);

    if (error) {
        console.error('Error eliminando documento del camión:', error);
        throw error;
    }
};
