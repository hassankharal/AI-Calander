import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useUserMemory } from '../hooks/useUserMemory';
import { UserMemory } from '../types/userMemory';
import { defaultUserMemory } from '../data/userMemoryStore';
import { colors, glass, typography } from '../theme';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PersonalSetupScreen({ onExit }: { onExit: () => void }) {
    const { memory, saveMemory, loading } = useUserMemory();
    const [form, setForm] = useState<UserMemory>(defaultUserMemory());
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (memory) {
            // eslint-disable-next-line
            setForm(JSON.parse(JSON.stringify(memory)));
        }
    }, [memory]);
    // Auto-init availability if empty on step 3
    useEffect(() => {
        if (!loading && step === 3) {
            // eslint-disable-next-line
            setForm(prev => {
                if (prev.weeklyAvailability.length === 0) {
                    return { ...prev, weeklyAvailability: [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], blocks: [{ start: '09:00', end: '17:00' }] }] };
                }
                return prev;
            });
        }
    }, [step, loading]);

    if (loading) return <View style={styles.center}><Text>Loading...</Text></View>;

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => setStep(s => s - 1);

    const handleSave = async () => {
        await saveMemory(form);
        onExit();
    };

    const updateSleep = (field: 'start' | 'end', val: string) => {
        setForm({ ...form, sleepWindow: { ...form.sleepWindow, [field]: val } });
    };

    const toggleDayForBlock = (blockIdx: number, day: string) => {
        const blocks = [...form.weeklyAvailability];
        if (!blocks[blockIdx]) {
            blocks[blockIdx] = { days: [], blocks: [] }; // Init if missing logic, but we simplify structure
            // Actually, let's simplify: we will just have one array of blocks in form state for the UI, 
            // then map properly. But type says WeeklyAvailability[] which groups by days.
            // Let's simplify UI state: just edit the first WeeklyAvailability group for now or create a flat structure for UI.
            // To stick to requirements "add 1-3 blocks", let's assume we edit `weeklyAvailability` array directly.
        }
        const currentDays = blocks[blockIdx].days;
        blocks[blockIdx].days = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
        setForm({ ...form, weeklyAvailability: blocks });
    };

    // Helper to ensure at least one availability group exists
    const ensureAvailabilityGroup = () => {
        if (form.weeklyAvailability.length === 0) {
            setForm({ ...form, weeklyAvailability: [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], blocks: [{ start: '09:00', end: '17:00' }] }] });
        }
    };

    const updateBlockTime = (groupIdx: number, blockIdx: number, field: 'start' | 'end', val: string) => {
        const w = [...form.weeklyAvailability];
        if (w[groupIdx] && w[groupIdx].blocks[blockIdx]) {
            w[groupIdx].blocks[blockIdx][field] = val;
            setForm({ ...form, weeklyAvailability: w });
        }
    };

    // --- STEPS RENDERERS ---

    const renderStep1 = () => (
        <View>
            <Text style={styles.stepTitle}>Step 1: The Basics</Text>
            <Text style={styles.label}>What should we call you?</Text>
            <TextInput
                style={styles.input}
                placeholder="Name (Optional)"
                placeholderTextColor={colors.textSecondary}
                value={form.preferredName || ''}
                onChangeText={t => setForm({ ...form, preferredName: t })}
                keyboardAppearance="dark"
            />
            <Text style={styles.label}>Timezone</Text>
            <TextInput
                style={styles.input}
                value={form.timezone}
                onChangeText={t => setForm({ ...form, timezone: t })}
                keyboardAppearance="dark"
            />
        </View>
    );

    const renderStep2 = () => (
        <View>
            <Text style={styles.stepTitle}>Step 2: Sleep & Energy</Text>
            <Text style={styles.label}>Sleep Window (approx)</Text>
            <View style={styles.row}>
                <TextInput
                    style={styles.inputHalf}
                    placeholder="Bedtime"
                    value={form.sleepWindow.start}
                    onChangeText={t => updateSleep('start', t)}
                />
                <TextInput
                    style={styles.inputHalf}
                    placeholder="Wake Up"
                    value={form.sleepWindow.end}
                    onChangeText={t => updateSleep('end', t)}
                />
            </View>
            <Text style={styles.label}>Ideal Sleep Hours</Text>
            <TextInput
                style={styles.input}
                keyboardType="numeric"
                keyboardAppearance="dark"
                placeholder="8"
                placeholderTextColor={colors.textSecondary}
                value={form.idealSleepHours?.toString() || ''}
                onChangeText={t => setForm({ ...form, idealSleepHours: parseInt(t) || 8 })}
            />
        </View>
    );

    const renderStep3 = () => (
        <View>
            <Text style={styles.stepTitle}>Step 3: Weekly Defaults</Text>
            <Text style={styles.subtext}>Set your main work/school block.</Text>

            {/* Simplify: Just edit the first group for onboarding */}
            {form.weeklyAvailability.map((group, gIdx) => (
                <View key={gIdx} style={styles.card}>
                    <Text style={styles.label}>Days</Text>
                    <View style={styles.chipRow}>
                        {ALL_DAYS.map(d => (
                            <TouchableOpacity
                                key={d}
                                style={[styles.chip, group.days.includes(d) && styles.chipActive]}
                                onPress={() => toggleDayForBlock(gIdx, d)}
                            >
                                <Text style={[styles.chipText, group.days.includes(d) && styles.chipTextActive]}>{d}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {group.blocks.map((b, bIdx) => (
                        <View key={bIdx} style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tinyLabel}>Start</Text>
                                <TextInput
                                    style={styles.input}
                                    value={b.start}
                                    keyboardAppearance="dark"
                                    onChangeText={t => updateBlockTime(gIdx, bIdx, 'start', t)}
                                />
                            </View>
                            <View style={{ width: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tinyLabel}>End</Text>
                                <TextInput
                                    style={styles.input}
                                    value={b.end}
                                    keyboardAppearance="dark"
                                    onChangeText={t => updateBlockTime(gIdx, bIdx, 'end', t)}
                                />
                            </View>
                        </View>
                    ))}
                </View>
            ))}
            <TouchableOpacity style={styles.smallBtn} onPress={() => {
                ensureAvailabilityGroup();
                if (form.weeklyAvailability.length === 0) ensureAvailabilityGroup();
            }}>
                <Text style={styles.smallBtnText}>Reset / Ensure Defaults</Text>
            </TouchableOpacity>
        </View>
    );

    const renderStep4 = () => (
        <View>
            <Text style={styles.stepTitle}>Step 4: Meal Times</Text>
            {form.mealTimes.map((meal, idx) => (
                <View key={idx} style={styles.rowCentered}>
                    <Text style={styles.labelFixed}>{meal.label.toUpperCase()}</Text>
                    <TextInput
                        style={styles.input}
                        value={meal.time}
                        onChangeText={t => {
                            const meals = [...form.mealTimes];
                            meals[idx].time = t;
                            setForm({ ...form, mealTimes: meals });
                        }}
                    />
                </View>
            ))}
        </View>
    );

    const renderStep5 = () => (
        <View>
            <Text style={styles.stepTitle}>Step 5: Planning Prefs</Text>

            <Text style={styles.label}>Default Event Duration</Text>
            <View style={styles.rowWrap}>
                {[30, 45, 60, 90].map(m => (
                    <TouchableOpacity key={m} style={[styles.pill, form.defaultEventMinutes === m && styles.pillActive]} onPress={() => setForm({ ...form, defaultEventMinutes: m })}>
                        <Text style={[styles.pillText, form.defaultEventMinutes === m && styles.pillTextActive]}>{m}m</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>Default Task Duration</Text>
            <View style={styles.rowWrap}>
                {[5, 15, 30, 60].map(m => (
                    <TouchableOpacity key={m} style={[styles.pill, form.defaultTaskMinutes === m && styles.pillActive]} onPress={() => setForm({ ...form, defaultTaskMinutes: m })}>
                        <Text style={[styles.pillText, form.defaultTaskMinutes === m && styles.pillTextActive]}>{m}m</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>Style</Text>
            <View style={styles.rowWrap}>
                {(['packed', 'balanced', 'spaced'] as const).map(s => (
                    <TouchableOpacity key={s} style={[styles.pill, form.schedulingStyle === s && styles.pillActive]} onPress={() => setForm({ ...form, schedulingStyle: s })}>
                        <Text style={[styles.pillText, form.schedulingStyle === s && styles.pillTextActive]}>{s}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderStep6 = () => (
        <View>
            <Text style={styles.stepTitle}>Ready to go!</Text>
            <Text style={styles.text}>
                We have captured your basics. You can edit these anytime in Settings.
            </Text>
            <Text style={styles.text}>
                Identity: {form.preferredName || 'You'} ({form.timezone})
            </Text>
            <Text style={styles.text}>
                Sleep: {form.sleepWindow.start} - {form.sleepWindow.end}
            </Text>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Profile</Text>
            </TouchableOpacity>
        </View>
    );



    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.header}>Personal Setup</Text>

                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                    {step === 5 && renderStep5()}
                    {step === 6 && renderStep6()}

                </ScrollView>
                <View style={styles.footer}>
                    {step > 1 && (
                        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                            <Text style={styles.backBtnText}>Back</Text>
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }} />
                    {step < 6 && (
                        <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
                            <Text style={styles.nextBtnText}>Next</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.obsidian },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, paddingBottom: 100 },
    header: { ...typography.headline, fontWeight: 'bold', marginBottom: 20, color: colors.textPrimary },
    stepTitle: { ...typography.headline, fontSize: 20, fontWeight: '600', marginBottom: 15, color: colors.textPrimary },
    label: { ...typography.body, fontSize: 16, marginBottom: 8, color: colors.textSecondary, fontWeight: '500' },
    labelFixed: { fontSize: 14, width: 80, color: colors.textPrimary, fontWeight: '600' },
    tinyLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
    text: { ...typography.body, fontSize: 16, color: colors.textPrimary, marginBottom: 10 },
    subtext: { fontSize: 14, color: colors.textSecondary, marginBottom: 15 },
    input: { ...glass.card, color: colors.textPrimary, padding: 12, marginBottom: 15, fontSize: 16 },
    inputHalf: { ...glass.card, flex: 1, color: colors.textPrimary, padding: 12, fontSize: 16 },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
    rowCentered: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    card: { ...glass.card, padding: 15, borderRadius: 12, marginBottom: 15 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 },
    chip: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass, alignItems: 'center', justifyContent: 'center' },
    chipActive: { backgroundColor: colors.textPrimary }, // White active
    chipText: { fontSize: 12, color: colors.textSecondary },
    chipTextActive: { color: colors.obsidian, fontWeight: 'bold' },

    pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass },
    pillActive: { backgroundColor: colors.textPrimary }, // White active
    pillText: { color: colors.textSecondary },
    pillTextActive: { color: colors.obsidian, fontWeight: '600' },

    footer: { flexDirection: 'row', padding: 20, borderTopWidth: 1, borderColor: colors.borderGlass, backgroundColor: colors.obsidian },
    backBtn: { padding: 15 },
    backBtnText: { color: colors.textPrimary, fontSize: 16 },
    nextBtn: { ...glass.interactive, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
    nextBtnText: { color: colors.textPrimary, fontWeight: 'bold', fontSize: 16 },

    saveBtn: { backgroundColor: colors.moss, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
    saveBtnText: { color: colors.obsidian, fontSize: 18, fontWeight: 'bold' },

    smallBtn: { alignSelf: 'flex-start', padding: 8 },
    smallBtnText: { color: colors.textPrimary, fontSize: 14 }
});
