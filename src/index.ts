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
		// SREG: 0x5F. 8 bit.
		return this.sramDataView.getUint16(0x5f, true)
	}

	set statusRegister(value) {
		// SREG: 0x5F. 8 bit.
		this.sramDataView.setUint16(0x5f, value, true)
	}

	public executeInstruction() {
		// Each instruction is either 16 bit or 32 bit.
		const opcode = this.flashDataView.getUint16(this.programCounter, true)

		console.log('Instruction', this.programCounter, opcode.toString(2).padStart(12, '0'))

		if ((opcode & 0b1111110000000000) >> 10 === 0b000111) {
			// ADC
			console.log('ADC')

			this.programCounter += 2
			this.cycles += 1
		} else if ((opcode & 0b1111111100000000) >> 8 === 0b10011010) {
			// SBI, 1001 1010 AAAA Abbb. 2 cycles.
			console.log('SBI')

			this.programCounter += 2
			this.cycles += 2
		} else if ((opcode & 0b1111000000000000) >> 12 === 0b1100) {
			// RJMP, 1100 kkkk kkkk kkkk. 2 cycles.
			console.log('RJMP')

			const offset12bit = opcode & 0b0000111111111111

			// Bitwise Sign Extension. Convert unsigned into signed.
			const offsetSigned = (offset12bit << 20) >> 20

			this.programCounter += offsetSigned * 2 + 2

			this.cycles += 2
		} else {
			console.log('Unknown opcode', opcode.toString(2).padStart(16, '0'))
		}
	}
}

const exampleHex = await fs.readFile('./examples/asm/test/test.hex', 'ascii')

const { data } = intelHex.parse(exampleHex)

const cpu = new CPU(data)

for (let i = 0; i < 10; i++) {
	console.log(`Cycle ${cpu.cycles}`)
	cpu.executeInstruction()
}
