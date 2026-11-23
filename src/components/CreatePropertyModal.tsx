import React, { useState, useEffect } from 'react';
import { Plus, X, Building, Upload, Edit3, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { Profile, Property, PropertyType, ListingType } from '../types/database';

interface CreatePropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile;
  onSuccess: () => void;
  editingProperty?: Property | null;
}

export const CreatePropertyModal: React.FC<CreatePropertyModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
  editingProperty
}) => {
  const isEditing = Boolean(editingProperty);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [listingType, setListingType] = useState<ListingType>('sell');
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [bathrooms, setBathrooms] = useState<number>(3);
  const [areaSqft, setAreaSqft] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [amenitiesInput, setAmenitiesInput] = useState('Swimming Pool, Gym, 24/7 Security, Power Backup, Parking');
  const [imageUrl, setImageUrl] = useState('');
  const [mediaList, setMediaList] = useState<string[]>([]);

  // Plot / land listings have no bedrooms or bathrooms — think like an Indian constructor
  const LAND_TYPES: PropertyType[] = ['plot', 'land'];
  const isLand = LAND_TYPES.includes(propertyType);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Pre-fill form when editing an existing property
  useEffect(() => {
    if (editingProperty) {
      setTitle(editingProperty.title || '');
      setDescription(editingProperty.description || '');
      setPrice(editingProperty.price ?? '');
      setPropertyType(editingProperty.property_type || 'apartment');
      setListingType(editingProperty.listing_type || 'sell');
      setBedrooms(editingProperty.bedrooms ?? 0);
      setBathrooms(editingProperty.bathrooms ?? 0);
      setAreaSqft(editingProperty.area_sqft ?? '');
      setLocation(editingProperty.location || '');
      setCity(editingProperty.city || 'Mumbai');
      setAmenitiesInput((editingProperty.amenities || []).join(', '));
      const existingMedia = editingProperty.media?.map(m => m.url) || editingProperty.images || [];
      setMediaList(existingMedia);
    } else {
      // Reset for new property
      setTitle('');
      setDescription('');
      setPrice('');
      setPropertyType('apartment');
      setListingType('sell');
      setBedrooms(3);
      setBathrooms(3);
      setAreaSqft('');
      setLocation('');
      setCity('Mumbai');
      setAmenitiesInput('Swimming Pool, Gym, 24/7 Security, Power Backup, Parking');
      setMediaList([]);
    }
    setErrorMsg(null);
    setUploadError(null);
  }, [editingProperty, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploadingImage(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const uploadedUrl = await api.uploadPropertyImage(file);
        setMediaList(prev => [...prev, uploadedUrl]);
      }
    } catch (err: any) {
      console.error('Image upload error:', err);
      setUploadError(
        `Image upload failed: ${err?.message || 'Unknown error'}. ` +
        `Check that the Supabase "properties" storage bucket exists and is set to public.`
      );
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    if (imageUrl.trim()) {
      setMediaList([...mediaList, imageUrl.trim()]);
      setImageUrl('');
    }
  };

  const handleRemoveImage = (idx: number) => {
    setMediaList(mediaList.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title || !price || !areaSqft || !location) {
      setErrorMsg('Please fill in all required fields (Title, Price, Area, Location).');
      return;
    }

    setLoading(true);
    try {
      const amenities = amenitiesInput.split(',').map(a => a.trim()).filter(Boolean);
      const finalMedia = mediaList.length > 0
        ? mediaList
        : ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200'];

      const finalBedrooms = isLand ? 0 : Number(bedrooms);
      const finalBathrooms = isLand ? 0 : Number(bathrooms);

      if (isEditing && editingProperty) {
        await api.updateProperty(editingProperty.id, {
          title,
          description,
          price: Number(price),
          property_type: propertyType,
          listing_type: listingType,
          bedrooms: finalBedrooms,
          bathrooms: finalBathrooms,
          area_sqft: Number(areaSqft),
          location,
          city,
          amenities,
          images: finalMedia,
        });
      } else {
        await api.createProperty(
          {
            title,
            description,
            price: Number(price),
            property_type: propertyType,
            listing_type: listingType,
            bedrooms: finalBedrooms,
            bathrooms: finalBathrooms,
            area_sqft: Number(areaSqft),
            location,
            city,
            status: 'available',
            owner_id: currentUser.id,
            featured: true,
            amenities
          },
          finalMedia
        );
      }

      setTitle('');
      setDescription('');
      setPrice('');
      setLocation('');
      setMediaList([]);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Property save error:', err);
      setErrorMsg(
        err.message ||
        'Could not save property. Please check your inputs or Supabase connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl">
              {isEditing ? <Edit3 className="w-5 h-5" /> : <Building className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-lg">{isEditing ? 'Edit Property' : 'List New Property'}</h3>
              <p className="text-xs text-slate-300">
                {isEditing ? 'Update your property listing details' : 'Publish property directly to IndoProperty customer discovery'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl font-bold">✕</button>
        </div>

        {/* Property error */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed space-y-1">
            <div className="flex items-center justify-between font-bold text-rose-700 text-sm">
              <span>❌ Database / Publishing Error</span>
              <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 font-bold">✕</button>
            </div>
            <p className="font-mono bg-white/80 p-2 rounded-lg border border-rose-100 text-rose-800 overflow-x-auto">{errorMsg}</p>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Property Title</label>
            <input
              type="text" required value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Skyline Azure 4BHK Sea-Facing Penthouse"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Listing Type</label>
              <select value={listingType} onChange={(e) => setListingType(e.target.value as ListingType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500">
                <option value="sell">Sell / Sale</option>
                <option value="rent">Rent</option>
                <option value="lease">Lease</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Property Type</label>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500">
                <option value="apartment">Apartment</option>
                <option value="villa">Villa</option>
                <option value="penthouse">Penthouse</option>
                <option value="plot">Plot</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Price (₹ INR)</label>
              <input type="number" required value={price} onChange={(e) => setPrice(Number(e.target.value))}
                placeholder="48500000"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Area (Sq.Ft)</label>
              <input type="number" required value={areaSqft} onChange={(e) => setAreaSqft(Number(e.target.value))}
                placeholder="4200"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 font-mono" />
            </div>
          </div>

          <div className={`grid gap-3 ${isLand ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
            {!isLand && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Bedrooms (BHK)</label>
                <input type="number" value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
            {!isLand && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Bathrooms</label>
                <input type="number" value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Location / Locality</label>
              <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="Worli Sea Face"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">City</label>
              <input type="text" required value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Mumbai"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500" />
            </div>
            {isLand && (
              <div className="col-span-1 md:col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Plot / Land listings don’t require BHK or bathroom details.
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Description</label>
            <textarea rows={3} required value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a compelling overview of the property, highlights, and finishes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Amenities (comma separated)</label>
            <input type="text" value={amenitiesInput} onChange={(e) => setAmenitiesInput(e.target.value)}
              placeholder="Swimming Pool, Gym, Smart Automation"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Media Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Property Photos
            </label>

            {/* Upload error */}
            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
                <span>❌ {uploadError}</span>
                <button type="button" onClick={() => setUploadError(null)} className="text-rose-500 font-bold shrink-0">✕</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className={`relative border-2 border-dashed rounded-xl p-3 text-center transition cursor-pointer flex items-center justify-center gap-2 text-xs font-bold
                ${uploadingImage ? 'border-indigo-400 bg-indigo-100 text-indigo-400' : 'border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 text-indigo-700'}`}>
                <input
                  type="file" accept="image/*" multiple
                  onChange={handleFileUpload}
                  disabled={uploadingImage}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <Upload className="w-4 h-4 text-indigo-600" />
                {uploadingImage ? 'Uploading...' : 'Upload Photo Files'}
              </div>

              <div className="flex gap-2">
                <input
                  type="url" value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or paste photo URL"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                />
                <button type="button" onClick={handleAddImageUrl}
                  className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {mediaList.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {mediaList.map((url, i) => (
                  <div key={i} className="relative w-20 h-14 rounded-lg overflow-hidden border shrink-0 group">
                    <img src={url} alt={`Media ${i}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => handleRemoveImage(i)}
                      className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading || uploadingImage}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition disabled:opacity-50">
              {loading ? (isEditing ? 'Saving...' : 'Publishing...') : (isEditing ? 'Save Changes' : 'Publish Property')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
