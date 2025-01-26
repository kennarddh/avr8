import fs from 'fs/promises'
import intelHex from 'intel-hex'

class CPU {
	// 16 MHZ
	// 32 kB Flash
	// 2 kB SRAM
	// 1 kB EEPROM
	// 131 instructions
	// 32 8 bit general purpose registers
	// 6 of the 32 registers can be used as 3 16 bit general purpose registers
	// Stack pointer as 2 8-bit registers in the I/O space. Numbers of bits used are implementation dependent. No SPH only SPL.

	public sram = new Uint8Array(2 * 1048)
	public sramDataView = new DataView(this.sram.buffer)
	public flash = new Uint8Array(32 * 1048)
	public flashDataView = new DataView(this.flash.buffer)
	public programCounter = 0
	public cycles = 0

	private readonly statusRegisterAddress = 0x5f

	constructor(flashData: Uint8Array) {
		// Load the 'flashData' at the beginning
		this.flash.set(flashData, 0)

		// Fill the rest of flash memory with 0xFF:
		this.flash.fill(0xff, flashData.length)
	}

	get stackPointer() {
		// SPL: 0x5D, SPH: 0x5E. Both is 8 bit. Combined into 16 bit.
		return this.sramDataView.getUint16(0x5d, true)
	}

	set stackPointer(value) {
		// SPL: 0x5D, SPH: 0x5E. Both is 8 bit. Combined into 16 bit.
		this.sramDataView.setUint16(0x5d, value, true)
	}

	get statusRegister() {
		return this.sramDataView.getUint8(this.statusRegisterAddress)
	}

	set statusRegister(value) {
		this.sramDataView.setUint8(this.statusRegisterAddress, value)
	}

	public executeInstruction() {
		// Each instruction is either 16 bit or 32 bit.
		const opcode = this.flashDataView.getUint16(this.programCounter, true)

		console.log('Instruction', this.programCounter, opcode.toString(2).padStart(12, '0'))

		// Arithmetic and Logic Instructions
		// ADD
		if ((opcode & 0b1111110000000000) >> 10 === 0b000111) {
			// ADC, 0001 11rd dddd rrrr
			console.log('ADC')

			const registerD = (opcode & 0b0000000111110000) >> 4
			const registerR = ((opcode & 0b0000001000000000) >> 5) | (opcode & 0b0000000000001111)

			const Rd = this.sramDataView.getUint8(registerD)
			const Rr = this.sramDataView.getUint8(registerR)

			const sum = Rd + Rr + (this.statusRegister & 0b00000001) // Carry status bit

			// 8 bit overflow
			const R = sum & 255

			this.sramDataView.setUint8(registerD, R)

			// Set the status register

			const Rd3 = (Rd & (1 << 2)) >> 2
			const Rr3 = (Rr & (1 << 2)) >> 2
			const R3 = (R & (1 << 2)) >> 2

			const Rd7 = (Rd & (1 << 6)) >> 6
			const Rr7 = (Rr & (1 << 6)) >> 6
			const R7 = (R & (1 << 6)) >> 6

			const cBit = (Rd7 & Rr7) | (Rr7 & Number(!R7)) | (Number(!R7) & Rd7)
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = (Rd7 & Rr7 & Number(!R7)) | (Number(!Rd7) & Number(!Rr7) & R7)
			const sBit = nBit ^ vBit
			const hBit = (Rd3 & Rr3) | (Rr3 & Number(!R3)) | (Number(!R3) & Rd3)

			this.statusRegister &= 0b11000000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4
			this.statusRegister |= hBit << 5

			this.programCounter += 2
			this.cycles += 1
		}
		// ADIW
		// SUB
		// SUBI
		// SBC
		// SBCI
		// SBIW
		// AND
		// ANDI
		// OR
		// ORI
		// EOR
		// COM
		// NEG
		// SBR
		// CBR
		// INC
		// DEC
		// TST
		// CLR
		// SER
		// MUL
		// MULS
		// MULSU
		// FMUL
		// FMULS
		// FMULSU

		// Branch Instructions
		else if ((opcode & 0b1111000000000000) >> 12 === 0b1100) {
			// RJMP, 1100 kkkk kkkk kkkk
			console.log('RJMP')

			const offset12bit = opcode & 0b0000111111111111

			// Bitwise sign extension. Convert unsigned into signed.
			const offsetSigned = (offset12bit << 20) >> 20

			this.programCounter += offsetSigned * 2 + 2

			this.cycles += 2
		}
		// IJMP
		// JMP
		// RCALL
		// ICALL
		// CALL
		// RET
		// RETI
		// CPSE
		// CP
		// CPC
		// CPI
		// SBRC
		// SBRS
		// SBIC
		// SBIS
		// BRBS
		// BRBC
		// BREQ
		// BRNE
		// BRCS
		// BRCC
		// BRSH
		// BRLO
		// BRMI
		// BRPL
		// BRGE
		// BRLT
		// BRHS
		// BRHC
		// BRTS
		// BRTC
		// BRVS
		// BRVC
		// BRIE
		// BRID
		// EIJMP
		// EICALL

		// Bit and Bit-Test Instructions
		else if ((opcode & 0b1111111100000000) >> 8 === 0b10011010) {
			// SBI, 1001 1010 AAAA Abbb
			console.log('SBI')

			const registerA = (opcode & 0b0000000011111000) >> 3
			const b = opcode & 0b0000000000000111

			// Add 32 to offset general purpose registers to I/O space.
			const address = registerA + 32

			this.sramDataView.setUint8(address, this.sramDataView.getUint8(address) | (1 << b))

			this.programCounter += 2
			this.cycles += 2
		}
		// CBI
		// LSL
		// LSR
		// ROL
		// ROR
		// ASR
		// SWAP
		// BSET
		// BCLR
		// BST
		// BLD
		// SEC
		// CLC
		// SEN
		// CLN
		// SEZ
		// CLZ
		// SEI
		// CLI
		// SES
		// CLS
		// SEV
		// CLV
		// SET
		// CLT
		// SEH
		// CLH

		// Data Transfer Instructions
		// MOV
		// MOVW
		else if ((opcode & 0b1111000000000000) >> 12 === 0b1110) {
			// LDI, 1110 KKKK dddd KKKK
			console.log('LDI')

			const registerD = (opcode & 0b0000000011110000) >> 4
			const k = ((opcode & 0b0000111100000000) >> 4) | (opcode & 0b0000000000001111)

			// Add 16 because LDI can only load into the last 16 general purpose registers.
			const address = registerD + 16

			this.sramDataView.setUint8(address, k)

			this.programCounter += 2
			this.cycles += 1
		}
		// LDI
		// LD, X
		// LD, X+
		// LD, -X
		// LD, Y
		// LD, Y+
		// LD, -Y
		// LDD, Y + q
		// LD, Z
		// LD, Z+
		// LD, -Z
		// LDD, Z + q
		// LDS
		// ST, X
		// ST, X+
		// ST, -X
		// ST, Y
		// ST, Y+
		// ST, -Y
		// STD, Y + q
		// ST, Z
		// ST, Z+
		// ST, -Z
		// STD, Z + q
		// STS
		// LPM
		// LPM, Z
		// LPM, Z+
		// SPM
		// IN
		// OUT
		// PUSH
		// POP
		// ELPM

		// MCU Control Instructions
		// NOP
		// SLEEP
		// WDR
		// BREAK
		else {
			console.log('Unknown opcode', opcode.toString(2).padStart(16, '0'))
		}
	}
}

const exampleHex = await fs.readFile('./examples/asm/test/test.hex', 'ascii')

const { data } = intelHex.parse(exampleHex)

const cpu = new CPU(data)

for (let i = 0; i < 4; i++) {
	console.log(`Cycle ${cpu.cycles}`)
	cpu.executeInstruction()
}

console.log(cpu.sram.slice(0, 32))
