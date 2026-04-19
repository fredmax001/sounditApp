import React from 'react';

interface BookingFormProps {
  artistId?: string;
  artistName?: string;
  onClose?: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ artistId: _artistId, artistName: _artistName, onClose: _onClose }) => {
    return (
        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Book Your Spot</h2>
            <form className="space-y-4">
                <div>
                    <label className="block text-gray-400 text-sm mb-2">Full Name</label>
                    <input type="text" className="w-full px-4 py-2 bg-white/10 border border-white/10 rounded-lg text-white" />
                </div>
                <button type="submit" className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl">
                    Complete Booking
                </button>
            </form>
        </div>
    );
};

export default BookingForm;
