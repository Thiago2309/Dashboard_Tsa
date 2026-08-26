// Services/BD/inventario/maquinaria/maquinariaDocumentoService.ts
import { supabase } from '../../../superbase.service';

const BUCKET = 'documentos-maquinaria';

export interface MaquinariaDocumento {
    id?: number;
    maquinaria_id: number;
    nombre_documento: string;
    nombre_archivo: string;
    storage_path: string;
    url: string;
    tamanio_kb?: number;
    fecha_carga?: string;
}

export const fetchDocumentosByMaquinaria = async (maquinariaId: number): Promise<MaquinariaDocumento[]> => {
    const { data, error } = await supabase
        .from('maquinaria_documento')
        .select('*')
        .eq('maquinaria_id', maquinariaId)
        .order('fecha_carga', { ascending: false });

    if (error) {
        console.error('Error fetching documentos de la maquinaria:', error);
        throw error;
    }

    return data || [];
};

export const subirDocumentoMaquinaria = async (
    maquinariaId: number,
    file: File,
    nombreDocumento: string
): Promise<MaquinariaDocumento> => {
    const nombreSanitizado = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${maquinariaId}/${Date.now()}_${nombreSanitizado}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: 'application/pdf' });

    if (uploadError) {
        console.error('Error subiendo documento a storage:', uploadError);
        throw uploadError;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { data, error } = await supabase
        .from('maquinaria_documento')
        .insert([{
            maquinaria_id: maquinariaId,
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
        console.error('Error registrando documento de la maquinaria:', error);
        throw error;
    }

    return data;
};

export const eliminarDocumentoMaquinaria = async (documento: MaquinariaDocumento): Promise<void> => {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([documento.storage_path]);
    if (storageError) {
        console.error('Error eliminando archivo del storage:', storageError);
    }

    const { error } = await supabase
        .from('maquinaria_documento')
        .delete()
        .eq('id', documento.id);

    if (error) {
        console.error('Error eliminando documento de la maquinaria:', error);
        throw error;
    }
};
