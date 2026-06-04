import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Animated, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

const DAYS_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const HERO_H = 280;
const CITY_IMG = { uri: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800' };

// ── MiniCalendar ──────────────────────────────────────────────────────────────

function MiniCalendar({ allReportDates }) {
  const now        = new Date();
  const todayYear  = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate  = now.getDate();

  const [viewYear,  setViewYear]  = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const reportDays = new Set(
    allReportDates
      .filter(d => d.getFullYear() === viewYear && d.getMonth() === viewMonth)
      .map(d => d.getDate())
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isCurrentMonth = viewYear === todayYear && viewMonth === todayMonth;

  return (
    <View style={cal.card}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn} activeOpacity={0.7}>
          <Text style={cal.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={cal.header}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn} activeOpacity={0.7}>
          <Text style={cal.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={cal.grid}>
        {DAYS_SHORT.map(d => (
          <Text key={d} style={cal.dayLabel}>{d}</Text>
        ))}
        {cells.map((day, i) => {
          const isToday   = isCurrentMonth && day === todayDate;
          const hasReport = day !== null && reportDays.has(day);
          return (
            <View key={i} style={cal.cell}>
              {day !== null && (
                <>
                  <View style={[cal.dayCircle, isToday && cal.todayCircle]}>
                    <Text style={[cal.dayNum, isToday && cal.todayNum]}>{day}</Text>
                  </View>
                  {hasReport && <View style={cal.dot} />}
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── MenuOption — lista vertical ───────────────────────────────────────────────

function MenuOption({ icon, label, onPress, highlight = false }) {
  return (
    <TouchableOpacity
      style={[menu.row, highlight && menu.rowHighlight]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={menu.label}>{label}</Text>
      <Text style={menu.arrow}>›</Text>
      <View style={menu.iconCircle}>
        <Text style={menu.icon}>{icon}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [allReportDates, setAllReportDates] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [unreadCount,    setUnreadCount]    = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;

  const heroTranslateY = scrollY.interpolate({
    inputRange:  [0, HERO_H],
    outputRange: [0, -HERO_H * 0.4],
    extrapolate: 'clamp',
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [reportsRes, countRes] = await Promise.all([
            api.get('/reports/mine'),
            api.get('/notifications/unread-count'),
          ]);
          if (!active) return;
          const dates = (reportsRes.data.reportes || []).map(r => new Date(r.created_at));
          setAllReportDates(dates);
          setUnreadCount(countRes.data.count ?? 0);
        } catch (_) {}
        setLoadingReports(false);
      })();
      return () => { active = false; };
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const firstName = user?.nombre?.split(' ')[0] ?? 'Usuario';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.root}>

        {/* ── Parallax hero ── */}
        <Animated.View style={[s.hero, { transform: [{ translateY: heroTranslateY }] }]}>
          <ImageBackground source={CITY_IMG} style={s.heroBg} resizeMode="cover">
            {/* Overlay oscuro semitransparente */}
            <View style={s.heroOverlay}>
              <View style={s.heroInner}>
                <View style={s.heroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.greeting}>Hola, {firstName} 👋</Text>
                    <Text style={s.subGreeting}>¿Qué reportamos hoy?</Text>
                  </View>
                  <View style={s.heroActions}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Notifications')}
                      style={s.heroBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={s.heroBtnIcon}>🔔</Text>
                      {unreadCount > 0 && (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleLogout} style={s.heroBtn} activeOpacity={0.8}>
                      <Text style={s.heroBtnIcon}>⎋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.accentBar} />
              </View>
            </View>
          </ImageBackground>
        </Animated.View>

        {/* ── Scrollable content ── */}
        <Animated.ScrollView
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loadingReports
            ? <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
            : <MiniCalendar allReportDates={allReportDates} />
          }

          <Text style={s.sectionTitle}>¿Qué deseas hacer?</Text>

          <MenuOption icon="📝" label="Crear reporte"    highlight
            onPress={() => navigation.navigate('NewReportStep1')} />
          <MenuOption icon="📋" label="Mis reportes"
            onPress={() => navigation.navigate('MyReports')} />
          <MenuOption icon="🗺️" label="Mapa de calor"
            onPress={() => navigation.navigate('Heatmap')} />
          <MenuOption icon="👤" label="Mi perfil"
            onPress={() => navigation.navigate('Profile')} />
        </Animated.ScrollView>

      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.primary },
  root:          { flex: 1, backgroundColor: C.background },
  hero:          { position: 'absolute', top: 0, left: 0, right: 0, height: HERO_H, zIndex: 1 },
  heroBg:        { flex: 1 },
  heroOverlay:   { flex: 1, backgroundColor: 'rgba(86, 28, 36, 0.62)' },
  heroInner:     { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, justifyContent: 'space-between' },
  heroTop:       { flexDirection: 'row', alignItems: 'flex-start' },
  heroActions:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  heroBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroBtnIcon:   { fontSize: 18 },
  badge:         { position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.primary },
  badgeText:     { color: C.primary, fontSize: 9, fontWeight: '800' },
  accentBar:     { height: 3, width: 48, backgroundColor: C.accent, borderRadius: 2 },
  greeting:      { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  subGreeting:   { fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 4 },
  scrollContent: { paddingTop: HERO_H + 16, paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: C.primary, marginTop: 24, marginBottom: 12 },
});

const cal = StyleSheet.create({
  card:        { backgroundColor: C.surface, borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 },
  nav:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F3F4F6' },
  navArrow:    { fontSize: 22, color: C.primary, fontWeight: '600', lineHeight: 26 },
  header:      { fontSize: 15, fontWeight: '700', color: C.primary },
  grid:        { flexDirection: 'row', flexWrap: 'wrap' },
  dayLabel:    { width: '14.28%', textAlign: 'center', fontSize: 11, color: '#9CA3AF', fontWeight: '600', paddingVertical: 4 },
  cell:        { width: '14.28%', alignItems: 'center', paddingVertical: 3, minHeight: 38 },
  dayCircle:   { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: C.primary },
  dayNum:      { fontSize: 13, color: '#374151' },
  todayNum:    { color: '#FFFFFF', fontWeight: '800' },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginTop: 2 },
});

const menu = StyleSheet.create({
  row: {
    height: 68, backgroundColor: C.surface, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
  },
  rowHighlight: {
    borderLeftWidth: 4, borderLeftColor: C.accent,
  },
  label:      { flex: 1, fontSize: 16, fontWeight: '700', color: C.primary },
  arrow:      { fontSize: 20, color: '#9CA3AF', marginRight: 12, fontWeight: '300' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  icon:       { fontSize: 22 },
});
