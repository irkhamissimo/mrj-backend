const mongoose = require('mongoose');
const Menu = require('../models/Menu');
require('dotenv').config();

const menuItems = [
  {
    title: 'Ziyadah',
    path: '/ziyadah',
    order: 1,
    isActive: true
  },
  {
    title: 'Hafalan Belum Disetor',
    path: '/vault',
    order: 2,
    isActive: true
  },
  {
    title: 'Murajaah',
    path: '/murajaah',
    order: 3,
    isActive: true
  },
  {
    title: "Stats",
    path: "/stats",
    order: 4,
    isActive: true
  }
];

async function populateMenu() {
  try {
    await mongoose.connect("mongodb://localhost:27017/mrj");
    await Menu.deleteMany({}); // Clear existing menu items
    await Menu.insertMany(menuItems);
    console.log('Menu items populated successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error populating menu items:', error);
    process.exit(1);
  }
}

populateMenu(); 