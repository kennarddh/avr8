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

	constructor(public flashData: Uint8Array) {
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
		if ((opcode & 0b1111110000000000) >> 10 === 0b000011) {
			// ADD, 0000 11rd dddd rrrr
			console.log('ADD')

			const registerD = (opcode & 0b0000000111110000) >> 4
			const registerR = ((opcode & 0b0000001000000000) >> 5) | (opcode & 0b0000000000001111)

			const Rd = this.sramDataView.getUint8(registerD)
			const Rr = this.sramDataView.getUint8(registerR)

			const sum = Rd + Rr
			const R = sum & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const Rd3 = (Rd & (1 << 3)) >> 3
			const Rr3 = (Rr & (1 << 3)) >> 3
			const R3 = (R & (1 << 3)) >> 3

			const Rd7 = (Rd & (1 << 7)) >> 7
			const Rr7 = (Rr & (1 << 7)) >> 7
			const R7 = (R & (1 << 7)) >> 7

			const cBit = (Rd7 & Rr7) | (Rr7 & ~R7) | (~R7 & Rd7)
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = (Rd7 & Rr7 & ~R7) | (~Rd7 & ~Rr7 & R7)
			const sBit = nBit ^ vBit
			const hBit = (Rd3 & Rr3) | (Rr3 & ~R3) | (~R3 & Rd3)

			this.statusRegister &= 0b11000000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4
			this.statusRegister |= hBit << 5

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111110000000000) >> 10 === 0b000111) {
			// ADC, 0001 11rd dddd rrrr
			console.log('ADC')

			const registerD = (opcode & 0b0000000111110000) >> 4
			const registerR = ((opcode & 0b0000001000000000) >> 5) | (opcode & 0b0000000000001111)

			const Rd = this.sramDataView.getUint8(registerD)
			const Rr = this.sramDataView.getUint8(registerR)

			const sum = Rd + Rr + (this.statusRegister & 0b00000001) // Carry status bit
			const R = sum & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const Rd3 = (Rd & (1 << 3)) >> 3
			const Rr3 = (Rr & (1 << 3)) >> 3
			const R3 = (R & (1 << 3)) >> 3

			const Rd7 = (Rd & (1 << 7)) >> 7
			const Rr7 = (Rr & (1 << 7)) >> 7
			const R7 = (R & (1 << 7)) >> 7

			const cBit = (Rd7 & Rr7) | (Rr7 & ~R7) | (~R7 & Rd7)
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = (Rd7 & Rr7 & ~R7) | (~Rd7 & ~Rr7 & R7)
			const sBit = nBit ^ vBit
			const hBit = (Rd3 & Rr3) | (Rr3 & ~R3) | (~R3 & Rd3)

			this.statusRegister &= 0b11000000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4
			this.statusRegister |= hBit << 5

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111111100000000) >> 8 === 0b10010110) {
			// ADIW, 1001 0110 KKdd KKKK
			console.log('ADIW')

			const d = (opcode & 0b0000000000110000) >> 4
			const K = ((opcode & 0b0000000011000000) >> 2) | (opcode & 0b0000000000001111)

			const address = d * 2 + 24

			const Rd = this.sramDataView.getUint16(address, true)

			const sum = Rd + K
			const R = sum & 0xffff // 16 bit overflow

			this.sramDataView.setUint16(address, R, true)

			// Set status register bits
			const R15 = (R & (1 << 15)) >> 15
			const Rdh7 = (Rd & (1 << 15)) >> 15 // 7th bit (counting from) of high byte means 15th bit of 16 bit value or the last/sign bit.

			const cBit = ~R15 & Rdh7
			const zBit = Number(R === 0)
			const nBit = R15
			const vBit = ~Rdh7 & R15
			const sBit = nBit ^ vBit

			this.statusRegister &= 0b11100000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4

			this.programCounter += 2
			this.cycles += 2
		} else if ((opcode & 0b1111110000000000) >> 10 === 0b000110) {
			// SUB, 0001 10rd dddd rrrr
			console.log('SUB')

			const registerD = (opcode & 0b0000000111110000) >> 4
			const registerR = ((opcode & 0b0000001000000000) >> 5) | (opcode & 0b0000000000001111)

			const Rd = this.sramDataView.getUint8(registerD)
			const Rr = this.sramDataView.getUint8(registerR)

			const result = Rd - Rr
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const Rd3 = (Rd & (1 << 3)) >> 3
			const Rr3 = (Rr & (1 << 3)) >> 3
			const R3 = (R & (1 << 3)) >> 3

			const Rd7 = (Rd & (1 << 7)) >> 7
			const Rr7 = (Rr & (1 << 7)) >> 7
			const R7 = (R & (1 << 7)) >> 7

			const cBit = (~Rd7 & Rr7) | (Rr7 & R7) | (R7 & ~Rd7)
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = (Rd7 & ~Rr7 & ~R7) | (~Rd7 & Rr7 & R7)
			const sBit = nBit ^ vBit
			const hBit = (~Rd3 & Rr3) | (Rr3 & R3) | (R3 & ~Rd3)

			this.statusRegister &= 0b11000000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4
			this.statusRegister |= hBit << 5

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111000000000000) >> 12 === 0b0101) {
			// SUBI, 0101 KKKK dddd KKKK
			console.log('SUBI')

			const registerD = (opcode & 0b0000000011110000) >> 4
			const K = ((opcode & 0b0000111100000000) >> 4) | (opcode & 0b0000000000001111)

			// Add 16 because SUB can only work on the last 16 general purpose registers.
			const address = registerD + 16

			const Rd = this.sramDataView.getUint8(address)

			const result = Rd - K
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(address, R)

			// Set status register bits
			const Rd3 = (Rd & (1 << 3)) >> 3
			const K3 = (K & (1 << 3)) >> 3
			const R3 = (R & (1 << 3)) >> 3

			const Rd7 = (Rd & (1 << 7)) >> 7
			const K7 = (K & (1 << 7)) >> 7
			const R7 = (R & (1 << 7)) >> 7

			const cBit = (~Rd7 & K7) | (K7 & R7) | (R7 & ~Rd7)
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = (Rd7 & ~K7 & ~R7) | (~Rd7 & K7 & R7)
			const sBit = nBit ^ vBit
			const hBit = (~Rd3 & K3) | (K3 & R3) | (R3 & ~Rd3)

			this.statusRegister &= 0b11000000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4
			this.statusRegister |= hBit << 5

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111110000000000) >> 10 === 0b000010) {
			// SBC, 0000 10rd dddd rrrr
			console.log('SBC')

			const registerD = (opcode & 0b0000000111110000) >> 4
			const registerR = ((opcode & 0b0000001000000000) >> 5) | (opcode & 0b0000000000001111)

			const Rd = this.sramDataView.getUint8(registerD)
			const Rr = this.sramDataView.getUint8(registerR)

			const result = Rd - Rr - (this.statusRegister & 0b00000001) // Carry status bit
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const Rd3 = (Rd & (1 << 3)) >> 3
			const Rr3 = (Rr & (1 << 3)) >> 3
			const R3 = (R & (1 << 3)) >> 3

			const Rd7 = (Rd & (1 << 7)) >> 7
			const Rr7 = (Rr & (1 << 7)) >> 7
			const R7 = (R & (1 << 7)) >> 7

			const cBit = (~Rd7 & Rr7) | (Rr7 & R7) | (R7 & ~Rd7)
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = (Rd7 & ~Rr7 & ~R7) | (~Rd7 & Rr7 & R7)
			const sBit = nBit ^ vBit
			const hBit = (~Rd3 & Rr3) | (Rr3 & R3) | (R3 & ~Rd3)

			this.statusRegister &= 0b11000000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4
			this.statusRegister |= hBit << 5

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111000000000000) >> 12 === 0b0100) {
			// SBCI, 0100 KKKK dddd KKKK
			console.log('SBCI')

			const registerD = (opcode & 0b0000000011110000) >> 4
			const K = ((opcode & 0b0000111100000000) >> 4) | (opcode & 0b0000000000001111)

			// Add 16 because SUB can only work on the last 16 general purpose registers.
			const address = registerD + 16

			const Rd = this.sramDataView.getUint8(address)

			const result = Rd - K - (this.statusRegister & 0b00000001) // Carry status bit
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(address, R)

			// Set status register bits
			const Rd3 = (Rd & (1 << 3)) >> 3
			const K3 = (K & (1 << 3)) >> 3
			const R3 = (R & (1 << 3)) >> 3

			const Rd7 = (Rd & (1 << 7)) >> 7
			const K7 = (K & (1 << 7)) >> 7
			const R7 = (R & (1 << 7)) >> 7

			const cBit = (~Rd7 & K7) | (K7 & R7) | (R7 & ~Rd7)
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = (Rd7 & ~K7 & ~R7) | (~Rd7 & K7 & R7)
			const sBit = nBit ^ vBit
			const hBit = (~Rd3 & K3) | (K3 & R3) | (R3 & ~Rd3)

			this.statusRegister &= 0b11000000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4
			this.statusRegister |= hBit << 5

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111111100000000) >> 8 === 0b10010111) {
			// SBIW, 1001 0111 KKdd KKKK
			console.log('SBIW')

			const d = (opcode & 0b0000000000110000) >> 4
			const K = ((opcode & 0b0000000011000000) >> 2) | (opcode & 0b0000000000001111)

			const address = d * 2 + 24

			const Rd = this.sramDataView.getUint16(address, true)

			const result = Rd - K
			const R = result & 0xffff // 16 bit overflow

			this.sramDataView.setUint16(address, R, true)

			// Set status register bits
			const R15 = (R & (1 << 15)) >> 15
			const Rdh7 = (Rd & (1 << 15)) >> 15 // 7th bit (counting from) of high byte means 15th bit of 16 bit value or the last/sign bit.

			const cBit = R15 & ~Rdh7
			const zBit = Number(R === 0)
			const nBit = R15
			const vBit = ~R15 & Rdh7
			const sBit = nBit ^ vBit

			this.statusRegister &= 0b11100000 // Clear bits that are going to be set
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4

			this.programCounter += 2
			this.cycles += 2
		} else if ((opcode & 0b1111110000000000) >> 10 === 0b001000) {
			// AND, 0010 00rd dddd rrrr
			console.log('AND')

			const registerD = (opcode & 0b0000000111110000) >> 4
			const registerR = ((opcode & 0b0000001000000000) >> 5) | (opcode & 0b0000000000001111)

			const Rd = this.sramDataView.getUint8(registerD)
			const Rr = this.sramDataView.getUint8(registerR)

			const result = Rd & Rr
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const R7 = (R & (1 << 7)) >> 7

			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = 0
			const sBit = nBit ^ vBit

			this.statusRegister &= 0b11100001 // Clear bits that are going to be set
			// V bit is intentionally cleared but not set because it is always 0 after this instruction
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= sBit << 4

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111000000000000) >> 12 === 0b0111) {
			// ANDI, 0111 KKKK dddd KKKK
			console.log('ANDI')

			const registerD = (opcode & 0b0000000011110000) >> 4
			const K = ((opcode & 0b0000111100000000) >> 4) | (opcode & 0b0000000000001111)

			// Add 16 because ANDI can only work on the last 16 general purpose registers.
			const address = registerD + 16

			const Rd = this.sramDataView.getUint8(address)

			const result = Rd & K
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(address, R)

			// Set status register bits
			const R7 = (R & (1 << 7)) >> 7

			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = 0
			const sBit = nBit ^ vBit

			this.statusRegister &= 0b11100001 // Clear bits that are going to be set
			// V bit is intentionally cleared but not set because it is always 0 after this instruction
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111110000000000) >> 10 === 0b001010) {
			// OR, 0010 10rd dddd rrrr
			console.log('OR')

			const registerD = (opcode & 0b0000000111110000) >> 4
			const registerR = ((opcode & 0b0000001000000000) >> 5) | (opcode & 0b0000000000001111)

			const Rd = this.sramDataView.getUint8(registerD)
			const Rr = this.sramDataView.getUint8(registerR)

			const result = Rd | Rr
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const R7 = (R & (1 << 7)) >> 7

			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = 0
			const sBit = nBit ^ vBit

			this.statusRegister &= 0b11100001 // Clear bits that are going to be set
			// V bit is intentionally cleared but not set because it is always 0 after this instruction
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= sBit << 4

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111000000000000) >> 12 === 0b0110) {
			// ORI, 0110 KKKK dddd KKKK
			console.log('ORI')

			const registerD = (opcode & 0b0000000011110000) >> 4
			const K = ((opcode & 0b0000111100000000) >> 4) | (opcode & 0b0000000000001111)

			// Add 16 because ORI can only work on the last 16 general purpose registers.
			const address = registerD + 16

			const Rd = this.sramDataView.getUint8(address)

			const result = Rd | K
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(address, R)

			// Set status register bits
			const R7 = (R & (1 << 7)) >> 7

			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = 0
			const sBit = nBit ^ vBit

			this.statusRegister &= 0b11100001 // Clear bits that are going to be set
			// V bit is intentionally cleared but not set because it is always 0 after this instruction
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= vBit << 3
			this.statusRegister |= sBit << 4

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111110000000000) >> 10 === 0b001001) {
			// EOR, 0010 01rd dddd rrrr
			console.log('EOR')

			const registerD = (opcode & 0b0000000111110000) >> 4
			const registerR = ((opcode & 0b0000001000000000) >> 5) | (opcode & 0b0000000000001111)

			const Rd = this.sramDataView.getUint8(registerD)
			const Rr = this.sramDataView.getUint8(registerR)

			const result = Rd ^ Rr
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const R7 = (R & (1 << 7)) >> 7

			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = 0
			const sBit = nBit ^ vBit

			this.statusRegister &= 0b11100001 // Clear bits that are going to be set
			// V bit is intentionally cleared but not set because it is always 0 after this instruction
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= sBit << 4

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111110000001111) === 0b1001010000000000) {
			// COM, 1001 010d dddd 0000
			console.log('COM')

			const registerD = (opcode & 0b0000000111110000) >> 4

			const Rd = this.sramDataView.getUint8(registerD)

			const result = 0xff - Rd
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const R7 = (R & (1 << 7)) >> 7

			const cBit = 1
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = 0
			const sBit = nBit ^ vBit

			this.statusRegister &= 0b11100000 // Clear bits that are going to be set
			// V bit is intentionally cleared but not set because it is always 0 after this instruction
			this.statusRegister |= cBit
			this.statusRegister |= zBit << 1
			this.statusRegister |= nBit << 2
			this.statusRegister |= sBit << 4

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111110000001111) === 0b1001010000000001) {
			// NEG, 1001 010d dddd 0001
			console.log('NEG')

			const registerD = (opcode & 0b0000000111110000) >> 4

			const Rd = this.sramDataView.getUint8(registerD)

			const result = 0x00 - Rd
			const R = result & 0xff // 8 bit overflow

			this.sramDataView.setUint8(registerD, R)

			// Set status register bits
			const R3 = (R & (1 << 3)) >> 3
			const Rd3 = (Rd & (1 << 3)) >> 3

			const R7 = (R & (1 << 7)) >> 7

			const cBit = Number(R !== 0)
			const zBit = Number(R === 0)
			const nBit = R7
			const vBit = Number(R === 0x80)
			const sBit = nBit ^ vBit
			const hBit = R3 | Rd3

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
		// TODO: INC
		// TODO: DEC
		// TODO: MUL
		// TODO: MULS
		// TODO: MULSU
		// TODO: FMUL
		// TODO: FMULS
		// TODO: FMULSU

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
		// TODO: IJMP
		// TODO: JMP
		// TODO: RCALL
		// TODO: ICALL
		// TODO: CALL
		// TODO: RET
		// TODO: RETI
		// TODO: CPSE
		// TODO: CP
		// TODO: CPC
		// TODO: CPI
		// TODO: SBRC
		// TODO: SBRS
		// TODO: SBIC
		// TODO: SBIS
		// TODO: BRBS
		// TODO: BRBC
		// TODO: EIJMP
		// TODO: EICALL

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
		// TODO: CBI
		// TODO: LSL
		// TODO: LSR
		// TODO: ROL
		// TODO: ROR
		// TODO: ASR
		// TODO: SWAP
		// TODO: BSET
		// TODO: BCLR
		// TODO: BST
		// TODO: BLD
		// TODO: SEI

		// Data Transfer Instructions
		// TODO: MOV
		// TODO: MOVW
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
		// TODO: LD, X
		// TODO: LD, X+
		// TODO: LD, -X
		// TODO: LD, Y
		// TODO: LD, Y+
		// TODO: LD, -Y
		// TODO: LDD, Y + q
		// TODO: LD, Z
		// TODO: LD, Z+
		// TODO: LD, -Z
		// TODO: LDD, Z + q
		// TODO: LDS
		// TODO: ST, X
		// TODO: ST, X+
		// TODO: ST, -X
		// TODO: ST, Y
		// TODO: ST, Y+
		// TODO: ST, -Y
		// TODO: STD, Y + q
		// TODO: ST, Z
		// TODO: ST, Z+
		// TODO: ST, -Z
		// TODO: STD, Z + q
		// TODO: STS
		// TODO: LPM
		// TODO: LPM, Z
		// TODO: LPM, Z+
		// TODO: SPM
		// TODO: IN
		// TODO: OUT
		// TODO: PUSH
		// TODO: POP
		// TODO: ELPM

		// MCU Control Instructions
		// TODO: NOP
		// TODO: SLEEP
		// TODO: WDR
		// TODO: BREAK
		else {
			console.log('Unknown opcode', opcode.toString(2).padStart(16, '0'))

			this.programCounter += 2
			this.cycles += 1
		}

		this.programCounter %= this.flash.length
	}
}

const exampleHex = await fs.readFile('./examples/asm/test/test.hex', 'ascii')

const { data } = intelHex.parse(exampleHex)

const cpu = new CPU(data)

for (let i = 0; i < 3; i++) {
	console.log(`Cycle ${cpu.cycles}`)
	cpu.executeInstruction()
}

console.log(cpu.sram.slice(0, 32))
console.log(new Uint16Array(cpu.sram.buffer).slice(12, 16))
