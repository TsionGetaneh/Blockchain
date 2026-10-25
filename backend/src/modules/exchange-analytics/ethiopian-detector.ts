/**
 * EthiopianDetector
 *
 * Multi-signal heuristic engine that identifies Ethiopian-origin users
 * from exchange bulk data without missing any.
 *
 * Signals used (each contributes a confidence score):
 *  1. Phone number prefix (+251)
 *  2. IP geolocation country code (ET)
 *  3. National ID pattern (ETH prefix, 7-digit)
 *  4. Residential address (Ethiopian cities / regions)
 *  5. KYC country field (Ethiopia / ET)
 *  6. Fiat currency (ETB)
 *  7. Timezone (Africa/Addis_Ababa, UTC+3)
 *  8. Name pattern (Amharic/Tigrinya/Oromo name corpus)
 *  9. Tax ID pattern (TIN-XXXXXX)
 * 10. Language/locale (am, om, ti)
 *
 * A user is classified as Ethiopian if total confidence >= 0.4
 * (i.e., at least 2 medium-strength signals or 1 strong signal).
 */

export type EthiopianSignal = {
    signal: string
    matched: boolean
    confidence: number
    evidence: string
}

export type EthiopianDetectionResult = {
    isEthiopian: boolean
    confidenceScore: number   // 0.0 – 1.0
    signals: EthiopianSignal[]
    matchedSignals: string[]
    recommendation: 'confirmed' | 'probable' | 'possible' | 'unlikely'
}

// ─── Ethiopian name corpus ────────────────────────────────────────────────────
const ETHIOPIAN_FIRST_NAMES = new Set([
    // Amharic
    'abebe', 'tigist', 'dawit', 'hana', 'yonas', 'meron', 'biruk', 'selam', 'tesfaye', 'almaz',
    'haile', 'girma', 'worku', 'alemu', 'kebede', 'mulugeta', 'desta', 'belay', 'tewodros',
    'yohannes', 'solomon', 'samuel', 'daniel', 'michael', 'gabriel', 'raphael', 'ezra',
    'bethlehem', 'selamawit', 'hiwot', 'tsehay', 'fikirte', 'meseret', 'tigist', 'zewditu',
    'abreham', 'bereket', 'eyob', 'henok', 'natnael', 'robel', 'surafel', 'wondwossen',
    'abiy', 'lemma', 'demeke', 'gedu', 'shimeles', 'takele', 'aster', 'azeb', 'birtukan',
    'meaza', 'mekdes', 'nardos', 'rahel', 'rediet', 'saba', 'tigist', 'wubet', 'yeshi',
    // Oromo
    'caalaa', 'dammee', 'girmaa', 'guutuu', 'ifaa', 'jaalaa', 'lammii', 'nagaa', 'obsa',
    'qananii', 'roobaa', 'taammiruu', 'urjii', 'waaqoo', 'xiiqaa', 'yaadaa', 'zalaalam',
    // Tigrinya
    'amanuel', 'berhane', 'eyassu', 'fitsum', 'gebremichael', 'hagos', 'isaias', 'kidane',
    'leul', 'mebrahtu', 'negash', 'petros', 'rezene', 'semere', 'tekeste', 'woldemichael',
])

const ETHIOPIAN_LAST_NAMES = new Set([
    'tadesse', 'bekele', 'haile', 'girma', 'worku', 'alemu', 'kebede', 'tesfaye', 'mulugeta',
    'desta', 'belay', 'tewodros', 'yohannes', 'solomon', 'samuel', 'daniel', 'michael',
    'gabriel', 'abebe', 'mekonen', 'gebre', 'wolde', 'tsegay', 'berhe', 'tekle', 'araya',
    'berhane', 'negash', 'gebru', 'kifle', 'mehari', 'tewolde', 'hailu', 'assefa', 'demissie',
    'legesse', 'mengistu', 'tilahun', 'woldemariam', 'zegeye', 'zewdie', 'abate', 'adane',
    'amare', 'andarge', 'asfaw', 'ayele', 'balcha', 'bayou', 'birhane', 'bogale', 'chekol',
    'dagne', 'dejene', 'demeke', 'dereje', 'dires', 'duguma', 'eshete', 'fikadu', 'fikre',
    'gashaye', 'getachew', 'getahun', 'gezahegn', 'gizaw', 'gobena', 'guta', 'habte',
    'habtemariam', 'habtewold', 'hailu', 'hailemariam', 'haileslassie', 'habtamu',
])

// ─── Ethiopian cities / regions ───────────────────────────────────────────────
const ETHIOPIAN_LOCATIONS = new Set([
    'addis ababa', 'addis', 'dire dawa', 'mekelle', 'gondar', 'hawassa', 'bahir dar',
    'adama', 'jimma', 'dessie', 'jijiga', 'shashamane', 'bishoftu', 'arba minch',
    'hosaena', 'wolkite', 'debre birhan', 'debre markos', 'debre tabor', 'axum',
    'adigrat', 'shire', 'humera', 'gambela', 'assosa', 'nekemte', 'ambo', 'woliso',
    'bale robe', 'goba', 'dilla', 'yirgalem', 'awasa', 'ziway', 'nazret', 'harar',
    'ethiopia', 'ethiopian', 'et', 'addis abeba',
])

// ─── Ethiopian phone prefixes ─────────────────────────────────────────────────
const ETH_PHONE_PATTERNS = [
    /^\+251/,
    /^00251/,
    /^251[79]\d{8}$/,
    /^0[79]\d{8}$/,   // local format without country code
]

// ─── Ethiopian National ID pattern ───────────────────────────────────────────
const ETH_NATIONAL_ID = /^ETH\d{6,9}$/i

// ─── Ethiopian TIN pattern ────────────────────────────────────────────────────
const ETH_TIN = /^TIN-\d{6}$/i

// ─── Ethiopian IP ranges (Ethio Telecom ASN 24757, 37526) ────────────────────
// In production these would be real GeoIP lookups. Here we pattern-match
// known Ethio Telecom IP blocks as a heuristic.
const ETH_IP_PREFIXES = ['196.188.', '196.189.', '41.66.', '41.67.', '41.84.', '197.156.']

export class EthiopianDetector {
    /**
     * Analyse a raw user record from an exchange and return detection result.
     * The record can contain any combination of fields — missing fields are skipped.
     */
    detect(record: Record<string, string | undefined>): EthiopianDetectionResult {
        const signals: EthiopianSignal[] = []

        // ── Signal 1: Phone number ──────────────────────────────────────────────
        const phone = (record.phone ?? record.mobile ?? record.telephone ?? '').replace(/\s/g, '')
        const phoneMatch = ETH_PHONE_PATTERNS.some(p => p.test(phone))
        signals.push({
            signal: 'Phone Number (+251)',
            matched: phoneMatch,
            confidence: phoneMatch ? 0.85 : 0,
            evidence: phoneMatch ? `Phone ${phone} matches Ethiopian prefix +251` : 'No Ethiopian phone prefix',
        })

        // ── Signal 2: IP address ────────────────────────────────────────────────
        const ip = record.ip ?? record.ip_address ?? record.last_ip ?? ''
        const ipMatch = ETH_IP_PREFIXES.some(prefix => ip.startsWith(prefix))
        const ipCountry = (record.ip_country ?? record.geo_country ?? '').toLowerCase()
        const ipCountryMatch = ipCountry === 'et' || ipCountry === 'ethiopia'
        signals.push({
            signal: 'IP Geolocation (Ethiopia)',
            matched: ipMatch || ipCountryMatch,
            confidence: (ipMatch || ipCountryMatch) ? 0.80 : 0,
            evidence: ipMatch ? `IP ${ip} in Ethio Telecom range` : ipCountryMatch ? `IP country: ${ipCountry}` : 'IP not in Ethiopian range',
        })

        // ── Signal 3: National ID ───────────────────────────────────────────────
        const nationalId = record.national_id ?? record.id_number ?? record.nid ?? ''
        const nidMatch = ETH_NATIONAL_ID.test(nationalId)
        signals.push({
            signal: 'National ID (ETH prefix)',
            matched: nidMatch,
            confidence: nidMatch ? 0.95 : 0,
            evidence: nidMatch ? `National ID ${nationalId} matches Ethiopian format` : 'No Ethiopian national ID pattern',
        })

        // ── Signal 4: Residential address ──────────────────────────────────────
        const address = (record.address ?? record.residential_address ?? record.city ?? record.country ?? '').toLowerCase()
        const addressMatch = Array.from(ETHIOPIAN_LOCATIONS).some(loc => address.includes(loc))
        const countryField = (record.country ?? record.nationality ?? record.residence_country ?? '').toLowerCase()
        const countryMatch = countryField === 'et' || countryField === 'ethiopia' || countryField === 'ethiopian'
        signals.push({
            signal: 'Residential Address / Country',
            matched: addressMatch || countryMatch,
            confidence: (addressMatch || countryMatch) ? 0.90 : 0,
            evidence: addressMatch ? `Address contains Ethiopian location` : countryMatch ? `Country field: ${countryField}` : 'No Ethiopian location detected',
        })

        // ── Signal 5: KYC country ───────────────────────────────────────────────
        const kycCountry = (record.kyc_country ?? record.kyc_nationality ?? record.document_country ?? '').toLowerCase()
        const kycMatch = kycCountry === 'et' || kycCountry === 'ethiopia' || kycCountry === 'ethiopian'
        signals.push({
            signal: 'KYC Document Country (ET)',
            matched: kycMatch,
            confidence: kycMatch ? 0.95 : 0,
            evidence: kycMatch ? `KYC country: ${kycCountry}` : 'KYC country not Ethiopia',
        })

        // ── Signal 6: Fiat currency (ETB) ───────────────────────────────────────
        const currency = (record.fiat_currency ?? record.currency ?? record.deposit_currency ?? '').toUpperCase()
        const etbMatch = currency === 'ETB'
        signals.push({
            signal: 'Fiat Currency (ETB)',
            matched: etbMatch,
            confidence: etbMatch ? 0.75 : 0,
            evidence: etbMatch ? 'Fiat currency is Ethiopian Birr (ETB)' : `Currency: ${currency || 'unknown'}`,
        })

        // ── Signal 7: Timezone ──────────────────────────────────────────────────
        const tz = (record.timezone ?? record.time_zone ?? '').toLowerCase()
        const tzMatch = tz.includes('addis') || tz === 'africa/addis_ababa' || tz === 'eat' || tz === 'utc+3'
        signals.push({
            signal: 'Timezone (Africa/Addis_Ababa)',
            matched: tzMatch,
            confidence: tzMatch ? 0.60 : 0,
            evidence: tzMatch ? `Timezone: ${tz}` : 'Timezone not Ethiopian',
        })

        // ── Signal 8: Name pattern ──────────────────────────────────────────────
        const fullName = (record.full_name ?? record.name ?? `${record.first_name ?? ''} ${record.last_name ?? ''}`).toLowerCase().trim()
        const nameParts = fullName.split(/\s+/)
        const firstNameMatch = nameParts.some(p => ETHIOPIAN_FIRST_NAMES.has(p))
        const lastNameMatch = nameParts.some(p => ETHIOPIAN_LAST_NAMES.has(p))
        const nameMatch = firstNameMatch || lastNameMatch
        signals.push({
            signal: 'Name Pattern (Ethiopian corpus)',
            matched: nameMatch,
            confidence: nameMatch ? (firstNameMatch && lastNameMatch ? 0.70 : 0.45) : 0,
            evidence: nameMatch ? `Name "${fullName}" matches Ethiopian name corpus` : 'Name not in Ethiopian corpus',
        })

        // ── Signal 9: Tax ID (TIN) ──────────────────────────────────────────────
        const taxId = record.tax_id ?? record.tin ?? record.tax_number ?? ''
        const tinMatch = ETH_TIN.test(taxId)
        signals.push({
            signal: 'Tax ID (TIN-XXXXXX format)',
            matched: tinMatch,
            confidence: tinMatch ? 0.85 : 0,
            evidence: tinMatch ? `TIN ${taxId} matches Ethiopian format` : 'No Ethiopian TIN pattern',
        })

        // ── Signal 10: Language / locale ────────────────────────────────────────
        const locale = (record.locale ?? record.language ?? record.preferred_language ?? '').toLowerCase()
        const localeMatch = locale.startsWith('am') || locale.startsWith('om') || locale.startsWith('ti') || locale === 'amharic' || locale === 'oromo' || locale === 'tigrinya'
        signals.push({
            signal: 'Language / Locale (am/om/ti)',
            matched: localeMatch,
            confidence: localeMatch ? 0.65 : 0,
            evidence: localeMatch ? `Locale: ${locale}` : 'Locale not Ethiopian',
        })

        // ── Aggregate score ─────────────────────────────────────────────────────
        const matchedSignals = signals.filter(s => s.matched)
        const rawScore = matchedSignals.reduce((sum, s) => sum + s.confidence, 0)
        // Cap at 1.0 — multiple signals reinforce each other
        const confidenceScore = Math.min(rawScore, 1.0)

        const isEthiopian = confidenceScore >= 0.4

        let recommendation: EthiopianDetectionResult['recommendation']
        if (confidenceScore >= 0.85) recommendation = 'confirmed'
        else if (confidenceScore >= 0.60) recommendation = 'probable'
        else if (confidenceScore >= 0.40) recommendation = 'possible'
        else recommendation = 'unlikely'

        return {
            isEthiopian,
            confidenceScore: Math.round(confidenceScore * 100) / 100,
            signals,
            matchedSignals: matchedSignals.map(s => s.signal),
            recommendation,
        }
    }

    /**
     * Filter a bulk list of exchange user records and return only Ethiopians.
     * Each returned record is enriched with the detection result.
     */
    filterEthiopians(records: Record<string, string | undefined>[]): Array<{
        record: Record<string, string | undefined>
        detection: EthiopianDetectionResult
    }> {
        return records
            .map(record => ({ record, detection: this.detect(record) }))
            .filter(r => r.detection.isEthiopian)
            .sort((a, b) => b.detection.confidenceScore - a.detection.confidenceScore)
    }
}
