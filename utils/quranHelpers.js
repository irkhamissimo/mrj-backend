// Juz data mapping - each array contains [surahNumber, verseNumber] for start of juz
const juzMap = [
  [1, 1],    // Juz 1: Al-Fatihah 1 - Al-Baqarah 141
  [2, 142],  // Juz 2: Al-Baqarah 142 - 252
  [2, 253],  // Juz 3: Al-Baqarah 253 - Al-Imran 92
  [3, 93],   // Juz 4: Al-Imran 93 - 200, An-Nisa 1-23
  [4, 24],   // Juz 5: An-Nisa 24-147
  [4, 148],  // Juz 6: An-Nisa 148-176, Al-Ma'idah 1-81
  [5, 82],   // Juz 7: Al-Ma'idah 82-120, Al-An'am 1-110
  [6, 111],  // Juz 8: Al-An'am 111-165, Al-A'raf 1-87
  [7, 88],   // Juz 9: Al-A'raf 88-206, Al-Anfal 1-40
  [8, 41],   // Juz 10: Al-Anfal 41-75, At-Tawbah 1-92
  [9, 93],   // Juz 11: At-Tawbah 93-129, Yunus 1-109, Hud 1-5
  [11, 6],   // Juz 12: Hud 6-123, Yusuf 1-52
  [12, 53],  // Juz 13: Yusuf 53-111, Ar-Ra'd 1-43, Ibrahim 1-52
  [15, 1],   // Juz 14: Al-Hijr 1-99, An-Nahl 1-128
  [17, 1],   // Juz 15: Al-Isra 1-111, Al-Kahf 1-74
  [18, 75],  // Juz 16: Al-Kahf 75-110, Maryam 1-98, Taha 1-135
  [21, 1],   // Juz 17: Al-Anbiya 1-112, Al-Hajj 1-78
  [23, 1],   // Juz 18: Al-Mu'minun 1-118, An-Nur 1-64
  [25, 21],  // Juz 19: Al-Furqan 21-77, Ash-Shu'ara 1-227
  [27, 56],  // Juz 20: An-Naml 56-93, Al-Qasas 1-88, Al-Ankabut 1-45
  [29, 46],  // Juz 21: Al-Ankabut 46-69, Ar-Rum 1-60, Luqman 1-34
  [33, 31],  // Juz 22: Al-Ahzab 31-73, Saba 1-54, Fatir 1-45
  [36, 28],  // Juz 23: Ya-Sin 28-83, As-Saffat 1-182, Sad 1-88
  [39, 32],  // Juz 24: Az-Zumar 32-75, Ghafir 1-85
  [41, 47],  // Juz 25: Fussilat 47-54, Ash-Shura 1-53, Az-Zukhruf 1-89
  [46, 1],   // Juz 26: Al-Ahqaf 1-35, Muhammad 1-38
  [51, 31],  // Juz 27: Adh-Dhariyat 31-60, At-Tur 1-49
  [58, 1],   // Juz 28: Al-Mujadila 1-22, Al-Hashr 1-24
  [67, 1],   // Juz 29: Al-Mulk 1-30, Al-Qalam 1-52
  [78, 1]    // Juz 30: An-Naba 1-40, An-Nas 1-6
];

const getJuzNumber = (surahNumber, verseNumber) => {
  for (let juz = juzMap.length - 1; juz >= 0; juz--) {
    const [startSurah, startVerse] = juzMap[juz];
    if (surahNumber > startSurah || (surahNumber === startSurah && verseNumber >= startVerse)) {
      return juz + 1; // Adding 1 because juz numbers are 1-based
    }
  }
  return 1; // Default to first juz if no match found
};

module.exports = {
  getJuzNumber
}; 